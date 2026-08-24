/**
 * Statistik turunan untuk chart bulanan dan tabel ringkasan.
 *
 * Dipisah dari pity.ts dengan sengaja: pity.ts adalah modul yang dikunci
 * acceptance criteria dan tidak boleh membengkak. File ini memakai primitifnya
 * (pengurutan by id, normalisasi 301/400) untuk hal-hal yang murni tampilan.
 *
 * Logika murni — tanpa UI, tanpa network, tanpa teks yang dilihat pengguna.
 */

import { RANK } from "../config/gacha";
import type { UigfGachaType, WishRecord } from "../types/wish";
import { getBannerConfig, isStandardPoolFiveStar, normalizeGachaType, sortByIdAsc } from "./pity";

// ---------------------------------------------------------------------------
// Pull bernilai, lengkap dengan pity saat didapat
// ---------------------------------------------------------------------------

export interface RankedPull {
  id: string;
  name: string;
  itemType: string;
  time: string;
  /** Pull ke berapa sejak item serank sebelumnya. */
  pity: number;
  /** Hanya diisi untuk 5★ di banner dengan mekanik featured. */
  wonFeatured: boolean | null;
  wasGuaranteed: boolean;
}

export interface BannerStats {
  bannerId: UigfGachaType;
  totalPulls: number;
  fiveStars: RankedPull[];
  fourStars: RankedPull[];
  /** 4★ yang berupa karakter, dipisah karena tabel desain memecahnya. */
  fourStarCharacters: RankedPull[];
  fourStarWeapons: RankedPull[];
  /** 5★ yang memenangkan undian featured (tidak termasuk yang dijamin). */
  fiveStarWins: RankedPull[];
  /** 5★ yang ikut undian featured — penyebut untuk persentase menang. */
  fiveStarRolls: RankedPull[];
}

/** Apakah item_type ini karakter. API mengirim "Character"/"Weapon" dalam bahasa aktif. */
function isCharacter(itemType: string): boolean {
  return String(itemType).trim().toLowerCase().startsWith("char");
}

/**
 * Kumpulkan seluruh 5★ dan 4★ satu banner beserta pity masing-masing.
 *
 * Sama seperti computeBannerPity, 301 dan 400 dilebur jadi satu urutan
 * kronologis sebelum dihitung.
 */
export function computeBannerStats(
  records: readonly WishRecord[],
  bannerId: UigfGachaType,
): BannerStats {
  const banner = getBannerConfig(bannerId);
  const rows = sortByIdAsc(records.filter((r) => normalizeGachaType(r.gacha_type) === bannerId));

  const fiveStars: RankedPull[] = [];
  const fourStars: RankedPull[] = [];
  let sinceFive = 0;
  let sinceFour = 0;
  let guaranteedActive = false;

  for (const row of rows) {
    sinceFive++;
    sinceFour++;

    if (row.rank_type === RANK.FIVE) {
      const lost = banner.hasFeaturedMechanic && isStandardPoolFiveStar(row.name);
      fiveStars.push({
        id: row.id,
        name: row.name,
        itemType: row.item_type,
        time: row.time,
        pity: sinceFive,
        wonFeatured: banner.hasFeaturedMechanic ? (guaranteedActive ? null : !lost) : null,
        wasGuaranteed: guaranteedActive,
      });
      guaranteedActive = banner.guaranteeAfterLoss && lost;
      sinceFive = 0;
      sinceFour = 0;
    } else if (row.rank_type === RANK.FOUR) {
      fourStars.push({
        id: row.id,
        name: row.name,
        itemType: row.item_type,
        time: row.time,
        pity: sinceFour,
        wonFeatured: null,
        wasGuaranteed: false,
      });
      sinceFour = 0;
    }
  }

  const fiveStarRolls = fiveStars.filter((p) => p.wonFeatured !== null);

  return {
    bannerId,
    totalPulls: rows.length,
    fiveStars,
    fourStars,
    fourStarCharacters: fourStars.filter((p) => isCharacter(p.itemType)),
    fourStarWeapons: fourStars.filter((p) => !isCharacter(p.itemType)),
    fiveStarWins: fiveStarRolls.filter((p) => p.wonFeatured === true),
    fiveStarRolls,
  };
}

/** Rata-rata pity sekumpulan pull, atau null kalau kosong. */
export function averagePity(pulls: readonly RankedPull[]): number | null {
  if (pulls.length === 0) return null;
  const sum = pulls.reduce((total, pull) => total + pull.pity, 0);
  return sum / pulls.length;
}

// ---------------------------------------------------------------------------
// Pull per bulan
// ---------------------------------------------------------------------------

export type ChartSeries = "character" | "weapon" | "standard";

export interface MonthlyPoint {
  /** "2026-08" — dipakai untuk pengurutan. */
  key: string;
  /** "08/26" — label sumbu. */
  label: string;
  counts: Record<ChartSeries, number>;
}

const SERIES_OF_BANNER: Partial<Record<UigfGachaType, ChartSeries>> = {
  "301": "character",
  "302": "weapon",
  "200": "standard",
  "500": "standard",
  "100": "standard",
};

/**
 * Jumlah pull per bulan, per seri banner.
 *
 * `time` dipotong sebagai string, TIDAK lewat Date: itu waktu server, dan
 * mengonversinya akan menggeser bulan bagi pengguna di zona waktu lain.
 */
export function monthlyPulls(records: readonly WishRecord[], months = 13): MonthlyPoint[] {
  const buckets = new Map<string, Record<ChartSeries, number>>();

  for (const record of records) {
    const key = String(record.time).trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;

    const series = SERIES_OF_BANNER[normalizeGachaType(record.gacha_type)];
    if (!series) continue;

    const bucket = buckets.get(key) ?? { character: 0, weapon: 0, standard: 0 };
    bucket[series]++;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.keys()].sort();
  if (sorted.length === 0) return [];

  // Rentang diisi penuh supaya bulan tanpa pull tetap muncul sebagai celah,
  // bukan hilang dan membuat grafiknya bohong.
  const last = sorted[sorted.length - 1]!;
  const keys = monthRange(last, months).filter((key) => key >= sorted[0]! || buckets.has(key));

  return keys.map((key) => ({
    key,
    label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
    counts: buckets.get(key) ?? { character: 0, weapon: 0, standard: 0 },
  }));
}

/** `count` bulan yang berakhir di `lastKey`, menaik. Aritmetika string, bukan Date. */
function monthRange(lastKey: string, count: number): string[] {
  let year = Number(lastKey.slice(0, 4));
  let month = Number(lastKey.slice(5, 7));
  const keys: string[] = [];

  for (let i = 0; i < count; i++) {
    keys.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  return keys.reverse();
}

/** Total satu seri di seluruh rentang. */
export function seriesTotal(points: readonly MonthlyPoint[], series: ChartSeries): number {
  return points.reduce((total, point) => total + point.counts[series], 0);
}

/** Bulan dengan pull terbanyak di satu seri, atau null kalau semuanya nol. */
export function busiestMonth(
  points: readonly MonthlyPoint[],
  series: ChartSeries,
): MonthlyPoint | null {
  let best: MonthlyPoint | null = null;
  for (const point of points) {
    if (point.counts[series] === 0) continue;
    if (!best || point.counts[series] > best.counts[series]) best = point;
  }
  return best;
}
