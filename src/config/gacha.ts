/**
 * SUMBER KEBENARAN untuk seluruh angka gacha.
 *
 * Aturan gacha berubah tiap beberapa patch. Semua konstanta ada di file ini
 * supaya satu patch = satu file yang perlu disentuh. JANGAN menyebar angka
 * ini ke komponen atau ke lib lain.
 *
 * Status: diverifikasi Agustus 2026 (patch 6.x).
 *
 * Sumber:
 * - Base rate & hard pity: halaman "Details" resmi di dalam game
 *   (Character Event Wish 0.600% dijamin dalam 90 pull; Weapon Event Wish
 *   0.700% dijamin dalam 80 pull).
 * - Soft pity start & besar kenaikan per pull: tidak pernah diumumkan resmi;
 *   angka konsensus dari datamining + statistik komunitas berskala besar.
 * - Capturing Radiance: diperkenalkan di v5.0. Mekanisme persisnya tidak
 *   pernah dirilis dan sumber komunitas saling bertentangan, jadi di sini
 *   hanya dipakai sebagai satu angka konsolidasi (~55% rate featured efektif).
 *   JANGAN memodelkan detailnya.
 * - Epitomized Path: sejak v5.0 hanya butuh 1 Fate Point (dulu 2),
 *   sehingga worst case senjata featured = 160 pull. (Fitur ini fase 2.)
 */

import type { RawGachaType, UigfGachaType } from "../types/wish";

/** Kode banner mentah dari API HoYoverse. */
export const GACHA_TYPE = {
  NOVICE: "100",
  STANDARD: "200",
  CHARACTER: "301",
  /** Banner karakter kedua. BERBAGI PITY dengan 301. */
  CHARACTER_2: "400",
  WEAPON: "302",
  CHRONICLED: "500",
} as const satisfies Record<string, RawGachaType>;

/** Seluruh kode banner yang perlu ditarik saat import. Tarik per kode, terpisah. */
export const FETCHABLE_GACHA_TYPES: RawGachaType[] = ["100", "200", "301", "400", "302", "500"];

/**
 * Normalisasi kode banner mengikuti konvensi UIGF.
 * `400` -> `301` karena keduanya satu counter pity. Ini kesalahan paling umum
 * di tool buatan sendiri — importer paimon.moe pun pernah rusak karenanya.
 */
export const UIGF_GACHA_TYPE_MAP: Record<string, UigfGachaType> = {
  "100": "100",
  "200": "200",
  "301": "301",
  "400": "301",
  "302": "302",
  "500": "500",
};

export interface BannerConfig {
  /** Kode banner setelah normalisasi UIGF. */
  id: UigfGachaType;
  /** Kode mentah yang dilebur ke banner ini. */
  rawTypes: RawGachaType[];
  name: string;
  shortName: string;
  /** Peluang dasar 5★ per pull, sebelum soft pity. */
  baseRate5: number;
  /** Nomor pull saat rate 5★ mulai naik. */
  softPityStart: number;
  /** Nomor pull dengan 5★ dijamin. */
  hardPity: number;
  /** Kenaikan peluang 5★ per pull setelah soft pity, dalam poin persen (desimal). */
  softPityIncrement: number;
  /** Hard pity 4★. */
  hardPity4: number;
  /** Apakah banner punya mekanik featured vs standar saat dapat 5★ (50/50 atau 75/25). */
  hasFeaturedMechanic: boolean;
  /**
   * Apakah kalah undian featured otomatis menjamin 5★ berikutnya featured.
   * Karakter: ya. Senjata: TIDAK — di sana jaminannya lewat Epitomized Path
   * (Fate Point), yang merupakan fitur fase 2 dan tidak dimodelkan di sini.
   */
  guaranteeAfterLoss: boolean;
  /**
   * Peluang 5★ pertama jadi featured (bukan dalam status guaranteed).
   * Karakter: 50% nominal, ~55% efektif berkat Capturing Radiance.
   * Senjata: 75/25, tanpa Capturing Radiance.
   */
  featuredRate: number;
  /** Rate featured efektif yang ditampilkan ke pengguna. */
  effectiveFeaturedRate: number;
  /** Tampilkan sebagai kartu di dashboard. */
  showOnDashboard: boolean;
}

/**
 * Model probabilitas (berlaku untuk semua banner):
 *   pull 1 .. softPityStart-1        -> baseRate5
 *   pull softPityStart .. hardPity-1 -> baseRate5 + (n - softPityStart + 1) * softPityIncrement
 *   pull hardPity                    -> 1.0
 * Peluang kumulatif dalam N pull = 1 - Π(1 - p_i).
 */
export const BANNERS: Record<UigfGachaType, BannerConfig> = {
  "301": {
    id: "301",
    rawTypes: ["301", "400"],
    name: "Banner Karakter",
    shortName: "Karakter",
    baseRate5: 0.006,
    softPityStart: 74,
    hardPity: 90,
    softPityIncrement: 0.06,
    hardPity4: 10,
    hasFeaturedMechanic: true,
    guaranteeAfterLoss: true,
    featuredRate: 0.5,
    // Capturing Radiance menaikkan rate featured efektif dari 50% ke ~55%.
    effectiveFeaturedRate: 0.55,
    showOnDashboard: true,
  },
  "302": {
    id: "302",
    rawTypes: ["302"],
    name: "Banner Senjata",
    shortName: "Senjata",
    baseRate5: 0.007,
    // Soft pity senjata mulai lebih awal DAN hard pity-nya 80, bukan 90.
    softPityStart: 63,
    hardPity: 80,
    softPityIncrement: 0.07,
    hardPity4: 10,
    hasFeaturedMechanic: true,
    // Kalah 75/25 TIDAK memberi jaminan otomatis. Jaminan senjata hanya lewat
    // Epitomized Path (Fate Point), yang merupakan fitur fase 2.
    guaranteeAfterLoss: false,
    // Senjata bukan 50/50, melainkan 75/25. Tanpa Capturing Radiance.
    featuredRate: 0.75,
    effectiveFeaturedRate: 0.75,
    showOnDashboard: true,
  },
  "200": {
    id: "200",
    rawTypes: ["200"],
    name: "Banner Standar",
    shortName: "Standar",
    baseRate5: 0.006,
    softPityStart: 74,
    hardPity: 90,
    softPityIncrement: 0.06,
    hardPity4: 10,
    hasFeaturedMechanic: false,
    guaranteeAfterLoss: false,
    featuredRate: 1,
    effectiveFeaturedRate: 1,
    showOnDashboard: true,
  },
  "500": {
    id: "500",
    rawTypes: ["500"],
    name: "Chronicled Wish",
    shortName: "Chronicled",
    baseRate5: 0.006,
    softPityStart: 74,
    hardPity: 90,
    softPityIncrement: 0.06,
    hardPity4: 10,
    hasFeaturedMechanic: false,
    guaranteeAfterLoss: false,
    featuredRate: 1,
    effectiveFeaturedRate: 1,
    showOnDashboard: true,
  },
  "100": {
    id: "100",
    rawTypes: ["100"],
    name: "Novice Wish",
    shortName: "Novice",
    // Novice hanya tersedia 20 pull dan punya jaminan 5★ di dalam 20 pull itu.
    // Angka di bawah mengikuti banner standar; tidak pernah relevan dalam praktik
    // karena pity-nya tidak pernah mendekati soft pity. Tidak ditampilkan di dashboard.
    baseRate5: 0.006,
    softPityStart: 74,
    hardPity: 90,
    softPityIncrement: 0.06,
    hardPity4: 10,
    hasFeaturedMechanic: false,
    guaranteeAfterLoss: false,
    featuredRate: 1,
    effectiveFeaturedRate: 1,
    showOnDashboard: false,
  },
};

/** Urutan tampil di dashboard. */
export const DASHBOARD_BANNER_ORDER: UigfGachaType[] = ["301", "302", "200", "500"];

/** Semua banner yang dihitung pity-nya. */
export const ALL_BANNER_IDS: UigfGachaType[] = ["301", "302", "200", "500", "100"];

/**
 * 5★ karakter di standard pool (bisa keluar sebagai "kalah 50/50" di banner karakter).
 *
 * Dipakai sebagai heuristik MVP: aplikasi tidak punya database banner historis,
 * jadi tidak tahu siapa yang featured di masa lalu. Kalau 5★ terakhir ada di
 * daftar ini, berarti kalah 50/50 -> status guaranteed aktif.
 *
 * Deteksi ini bisa meleset (mis. karakter standard pool yang pernah jadi rate-up
 * di Chronicled Wish), jadi UI wajib menyediakan toggle koreksi manual.
 *
 * Perbarui daftar ini kalau HoYoverse menambah karakter ke standard pool.
 */
export const STANDARD_POOL_5STAR_CHARACTERS: string[] = [
  "Diluc",
  "Jean",
  "Qiqi",
  "Mona",
  "Keqing",
  "Tighnari",
  "Dehya",
];

/**
 * 5★ senjata di standard pool — padanan daftar di atas untuk banner senjata.
 * Kalau 5★ senjata yang keluar ada di daftar ini, berarti kalah undian 75/25.
 *
 * Catatan: berbeda dengan banner karakter, kalah 75/25 TIDAK memberi jaminan
 * otomatis untuk 5★ berikutnya — lihat `guaranteeAfterLoss` di atas.
 */
export const STANDARD_POOL_5STAR_WEAPONS: string[] = [
  "Amos' Bow",
  "Skyward Harp",
  "Lost Prayer to the Sacred Winds",
  "Skyward Atlas",
  "Skyward Pride",
  "Wolf's Gravestone",
  "Primordial Jade Winged-Spear",
  "Skyward Spine",
  "Aquila Favonia",
  "Skyward Blade",
];

/** Seluruh nama standard pool dalam huruf kecil, untuk pencocokan case-insensitive. */
export const STANDARD_POOL_5STAR_LOOKUP: ReadonlySet<string> = new Set(
  [...STANDARD_POOL_5STAR_CHARACTERS, ...STANDARD_POOL_5STAR_WEAPONS].map((n) => n.toLowerCase()),
);

/** Nilai `rank_type` dari API. */
export const RANK = {
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
} as const;

/** 1 pull = 160 primogem. */
export const PRIMOGEMS_PER_PULL = 160;

/**
 * Riwayat wish in-game hanya menyimpan 1 tahun terakhir sejak versi 4.5.
 * Pull yang lebih lama tidak bisa ditarik lagi lewat API — alasan kuat untuk export.
 */
export const WISH_HISTORY_RETENTION_DAYS = 365;
