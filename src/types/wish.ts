/**
 * Bentuk data wish — sengaja mengikuti bentuk mentah dari API HoYoverse
 * (semua field bertipe string, termasuk angka) supaya record hasil fetch bisa
 * disimpan apa adanya tanpa konversi yang bisa menghilangkan presisi `id`.
 */

/** Kode banner mentah dari API. */
export type RawGachaType = "100" | "200" | "301" | "400" | "302" | "500";

/**
 * Kode banner setelah dinormalisasi mengikuti konvensi UIGF.
 * `400` dilebur ke `301` karena keduanya berbagi satu counter pity.
 */
export type UigfGachaType = "100" | "200" | "301" | "302" | "500";

export interface WishRecord {
  /** Snowflake id. Naik kronologis. JANGAN diparse ke Number — melebihi Number.MAX_SAFE_INTEGER. */
  id: string;
  uid: string;
  /** Kode banner mentah, `400` masih mungkin muncul di sini. */
  gacha_type: string;
  item_id?: string;
  count?: string;
  /** "YYYY-MM-DD HH:mm:ss" dalam waktu server. Jangan dipakai untuk mengurutkan. */
  time: string;
  name: string;
  lang?: string;
  item_type: string;
  /** "3" | "4" | "5" */
  rank_type: string;
}

/** Satu 5★ yang pernah didapat, lengkap dengan pity saat itu. */
export interface FiveStarPull {
  id: string;
  name: string;
  itemType: string;
  time: string;
  /** Berapa pull yang dihabiskan untuk mendapatkan 5★ ini (1 = pull pertama setelah 5★ sebelumnya). */
  pity: number;
  /**
   * Apakah 5★ ini memenangkan undian featured (50/50 di karakter, 75/25 di senjata).
   * `null` kalau pertanyaannya tidak berlaku: banner tanpa mekanik featured,
   * atau pull ini memang sedang dalam status guaranteed.
   */
  wonFeatured: boolean | null;
  /** True kalau saat pull ini status guaranteed sedang aktif (5★ sebelumnya kalah 50/50). */
  wasGuaranteed: boolean;
}

/** Status lengkap satu banner, hasil akhir perhitungan pity. */
export interface BannerPityState {
  bannerId: UigfGachaType;
  /** Total pull yang tercatat di banner ini. */
  totalPulls: number;
  /** Pull sejak 5★ terakhir. Kalau belum pernah 5★, sama dengan totalPulls. */
  pity: number;
  /** Pull sejak 4★ terakhir. */
  pity4: number;
  /** Nomor pull berikutnya (= pity + 1). Angka inilah yang dipakai model probabilitas. */
  nextPullNumber: number;
  softPityStart: number;
  hardPity: number;
  /** True kalau pull berikutnya sudah masuk zona soft pity. */
  isSoftPity: boolean;
  /** Sisa pull sampai pull berikutnya masuk zona soft pity. 0 tepat saat isSoftPity true. */
  pullsToSoftPity: number;
  /** Sisa pull sampai hard pity (dijamin 5★). */
  pullsToHardPity: number;
  /** Peluang 5★ pada pull berikutnya saja (0–1). */
  nextPullChance: number;
  /** Apakah banner ini punya mekanik featured vs standar (50/50 atau 75/25). */
  hasFeaturedMechanic: boolean;
  /**
   * True kalau 5★ berikutnya dijamin featured.
   * Selalu false di banner yang kalah undiannya tidak memberi jaminan (senjata, standar).
   */
  guaranteed: boolean;
  /** True kalau `guaranteed` berasal dari koreksi manual pengguna, bukan deteksi otomatis. */
  guaranteedIsManual: boolean;
  /** Seluruh 5★ di banner ini, urut kronologis. */
  fiveStars: FiveStarPull[];
  /** 5★ terakhir, atau null kalau belum pernah. */
  last5Star: FiveStarPull | null;
  /** Waktu pull terakhir (string mentah dari API), atau null. */
  lastPullTime: string | null;
}

/** Koreksi manual status guaranteed per banner, disimpan di preferensi pengguna. */
export type GuaranteedOverrides = Partial<Record<UigfGachaType, boolean>>;
