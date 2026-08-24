/**
 * Logika pity murni. Tidak boleh punya dependensi ke UI atau network.
 * Seluruh angka gacha diambil dari src/config/gacha.ts — jangan tulis angka di sini.
 */

import {
  ALL_BANNER_IDS,
  BANNERS,
  PRIMOGEMS_PER_PULL,
  RANK,
  STANDARD_POOL_5STAR_LOOKUP,
  UIGF_GACHA_TYPE_MAP,
  type BannerConfig,
} from "../config/gacha";
import type {
  BannerPityState,
  FiveStarPull,
  GuaranteedOverrides,
  UigfGachaType,
  WishRecord,
} from "../types/wish";

// ---------------------------------------------------------------------------
// Normalisasi & pengurutan
// ---------------------------------------------------------------------------

/**
 * Normalisasi kode banner ke konvensi UIGF (400 -> 301).
 * Kode yang tidak dikenal dikembalikan apa adanya supaya data asing tidak hilang diam-diam.
 */
export function normalizeGachaType(rawGachaType: string): UigfGachaType {
  const key = String(rawGachaType).trim();
  const normalized = UIGF_GACHA_TYPE_MAP[key];
  return normalized ?? (key as UigfGachaType);
}

/**
 * Bandingkan dua id wish sebagai bilangan bulat besar.
 *
 * id berbentuk snowflake 19 digit — jauh melebihi Number.MAX_SAFE_INTEGER,
 * jadi parseInt/Number akan kehilangan presisi dan mengacaukan urutan.
 * Untuk string digit tanpa leading zero, "lebih panjang = lebih besar",
 * lalu perbandingan leksikografis sudah setara dengan perbandingan numerik.
 */
export function compareWishId(a: string, b: string): number {
  const left = stripLeadingZeros(String(a).trim());
  const right = stripLeadingZeros(String(b).trim());
  const bothNumeric = /^\d+$/.test(left) && /^\d+$/.test(right);
  if (bothNumeric && left.length !== right.length) return left.length - right.length;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}

/** Salinan record yang terurut kronologis berdasarkan id (bukan time). */
export function sortByIdAsc<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => compareWishId(a.id, b.id));
}

/**
 * Gabungkan beberapa sumber record, buang duplikat berdasarkan id, lalu urutkan.
 * Dipakai saat menggabungkan hasil import baru dengan data yang sudah tersimpan.
 */
export function dedupeAndSort<T extends { id: string }>(...sources: readonly T[][]): T[] {
  const byId = new Map<string, T>();
  for (const source of sources) {
    for (const record of source) {
      const key = stripLeadingZeros(String(record.id).trim());
      if (!byId.has(key)) byId.set(key, record);
    }
  }
  return sortByIdAsc([...byId.values()]);
}

/** Kelompokkan record per banner (sudah dinormalisasi ke kode UIGF) dan urutkan tiap grup. */
export function groupByBanner(records: readonly WishRecord[]): Map<UigfGachaType, WishRecord[]> {
  const groups = new Map<UigfGachaType, WishRecord[]>();
  for (const record of records) {
    const bannerId = normalizeGachaType(record.gacha_type);
    const bucket = groups.get(bannerId);
    if (bucket) bucket.push(record);
    else groups.set(bannerId, [record]);
  }
  for (const [bannerId, bucket] of groups) {
    groups.set(bannerId, sortByIdAsc(bucket));
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Model probabilitas
// ---------------------------------------------------------------------------

export function getBannerConfig(bannerId: UigfGachaType): BannerConfig {
  const banner = BANNERS[bannerId];
  if (!banner) throw new Error(`Banner tidak dikenal: ${bannerId}`);
  return banner;
}

/**
 * Peluang 5-bintang pada pull nomor pullNumber (1-indexed, dihitung sejak 5-bintang terakhir).
 * Mengembalikan 0 untuk nomor pull tidak valid, dan 1 tepat di hard pity.
 */
export function fiveStarRateAt(pullNumber: number, banner: BannerConfig): number {
  if (!Number.isFinite(pullNumber) || pullNumber < 1) return 0;
  if (pullNumber >= banner.hardPity) return 1;
  if (pullNumber < banner.softPityStart) return banner.baseRate5;
  const stepsIntoSoftPity = pullNumber - banner.softPityStart + 1;
  return Math.min(1, banner.baseRate5 + stepsIntoSoftPity * banner.softPityIncrement);
}

/**
 * Peluang mendapat minimal satu 5-bintang dalam `pulls` pull berikutnya,
 * bila saat ini pity berada di currentPity.
 *   P = 1 - product(1 - p_i)
 */
export function chanceWithin(currentPity: number, pulls: number, banner: BannerConfig): number {
  if (pulls <= 0) return 0;
  let missAll = 1;
  for (let i = 1; i <= pulls; i++) {
    missAll *= 1 - fiveStarRateAt(currentPity + i, banner);
    if (missAll <= 0) return 1;
  }
  return 1 - missAll;
}

/** Peluang 5-bintang berikutnya jadi featured, memperhitungkan status guaranteed. */
export function featuredChance(banner: BannerConfig, guaranteed: boolean): number {
  if (!banner.hasFeaturedMechanic) return 1;
  return guaranteed ? 1 : banner.effectiveFeaturedRate;
}

/** Konversi jumlah pull ke primogem. */
export function pullsToPrimogems(pulls: number): number {
  return Math.max(0, Math.ceil(pulls)) * PRIMOGEMS_PER_PULL;
}

/** Konversi primogem ke jumlah pull utuh yang bisa dibeli. */
export function primogemsToPulls(primogems: number): number {
  return Math.max(0, Math.floor(primogems / PRIMOGEMS_PER_PULL));
}

// ---------------------------------------------------------------------------
// Deteksi menang/kalah 50/50
// ---------------------------------------------------------------------------

/**
 * Apakah nama ini termasuk 5-bintang standard pool (karakter maupun senjata).
 *
 * Heuristik MVP — lihat catatan di src/config/gacha.ts. Bisa meleset, karena itu
 * status guaranteed selalu bisa dikoreksi manual lewat override.
 */
export function isStandardPoolFiveStar(name: string): boolean {
  return STANDARD_POOL_5STAR_LOOKUP.has(String(name).trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Perhitungan pity
// ---------------------------------------------------------------------------

export interface ComputePityOptions {
  /** Koreksi manual status guaranteed dari pengguna. Menimpa hasil deteksi otomatis. */
  guaranteedOverride?: boolean;
}

/**
 * Hitung status satu banner dari riwayat wish.
 *
 * `records` boleh berisi seluruh riwayat lintas banner — fungsi ini menyaring
 * sendiri berdasarkan kode banner yang sudah dinormalisasi, sehingga 301 dan 400
 * otomatis dihitung sebagai SATU urutan kronologis.
 */
export function computeBannerPity(
  records: readonly WishRecord[],
  bannerId: UigfGachaType,
  options: ComputePityOptions = {},
): BannerPityState {
  const banner = getBannerConfig(bannerId);
  const rows = sortByIdAsc(records.filter((r) => normalizeGachaType(r.gacha_type) === bannerId));

  const fiveStars: FiveStarPull[] = [];
  let sinceFiveStar = 0;
  let sinceFourStar = 0;
  // Status guaranteed dilacak berurutan: 5-bintang yang ditarik saat guaranteed aktif
  // bukan hasil undian, jadi tidak boleh dicap "menang".
  let guaranteedActive = false;

  for (const row of rows) {
    sinceFiveStar++;
    sinceFourStar++;

    if (row.rank_type === RANK.FIVE) {
      const lost = banner.hasFeaturedMechanic && isStandardPoolFiveStar(row.name);
      fiveStars.push({
        id: row.id,
        name: row.name,
        itemType: row.item_type,
        time: row.time,
        pity: sinceFiveStar,
        wonFeatured: banner.hasFeaturedMechanic ? (guaranteedActive ? null : !lost) : null,
        wasGuaranteed: guaranteedActive,
      });
      // Hanya banner karakter yang memberi jaminan setelah kalah undian.
      guaranteedActive = banner.guaranteeAfterLoss && lost;
      sinceFiveStar = 0;
      sinceFourStar = 0;
    } else if (row.rank_type === RANK.FOUR) {
      sinceFourStar = 0;
    }
  }

  const last5Star = fiveStars.length > 0 ? fiveStars[fiveStars.length - 1]! : null;
  const pity = sinceFiveStar;
  const nextPullNumber = pity + 1;

  const hasOverride = typeof options.guaranteedOverride === "boolean";
  const guaranteed = banner.guaranteeAfterLoss
    ? hasOverride
      ? (options.guaranteedOverride as boolean)
      : guaranteedActive
    : false;

  const lastRow = rows.length > 0 ? rows[rows.length - 1]! : null;

  return {
    bannerId,
    totalPulls: rows.length,
    pity,
    pity4: sinceFourStar,
    nextPullNumber,
    softPityStart: banner.softPityStart,
    hardPity: banner.hardPity,
    isSoftPity: nextPullNumber >= banner.softPityStart,
    // 0 tepat ketika isSoftPity true: pull berikutnya sudah dapat rate naik.
    pullsToSoftPity: Math.max(0, banner.softPityStart - 1 - pity),
    pullsToHardPity: Math.max(0, banner.hardPity - pity),
    nextPullChance: fiveStarRateAt(nextPullNumber, banner),
    hasFeaturedMechanic: banner.hasFeaturedMechanic,
    guaranteed,
    guaranteedIsManual: banner.guaranteeAfterLoss && hasOverride,
    fiveStars,
    last5Star,
    lastPullTime: lastRow ? lastRow.time : null,
  };
}

/** Hitung status seluruh banner sekaligus. Banner tanpa data tetap muncul dengan pity 0. */
export function computeAllPity(
  records: readonly WishRecord[],
  overrides: GuaranteedOverrides = {},
): Record<UigfGachaType, BannerPityState> {
  const result = {} as Record<UigfGachaType, BannerPityState>;
  for (const bannerId of ALL_BANNER_IDS) {
    const override = overrides[bannerId];
    result[bannerId] = computeBannerPity(
      records,
      bannerId,
      typeof override === "boolean" ? { guaranteedOverride: override } : {},
    );
  }
  return result;
}

/** Daftar UID unik yang ada di dalam data, urut menaik. */
export function extractUids(records: readonly WishRecord[]): string[] {
  return [...new Set(records.map((r) => String(r.uid).trim()).filter(Boolean))].sort();
}

/**
 * id tertinggi per kode banner MENTAH — dipakai sebagai cursor import incremental.
 * Sengaja pakai kode mentah, bukan UIGF, karena API ditarik per kode mentah
 * dan 400 punya cursor sendiri yang terpisah dari 301.
 */
export function latestIdByRawType(records: readonly WishRecord[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const record of records) {
    const key = String(record.gacha_type).trim();
    const current = latest[key];
    if (!current || compareWishId(record.id, current) > 0) latest[key] = record.id;
  }
  return latest;
}
