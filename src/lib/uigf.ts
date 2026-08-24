/**
 * Import & export UIGF v4.x.
 *
 * Spesifikasi: https://uigf.org/en/standards/uigf.html (diverifikasi Agustus 2026,
 * versi berjalan v4.2). Ringkasan yang mengikat:
 *
 * - Wajib di `info`   : export_timestamp, export_app, export_app_version, version
 * - Wajib per akun    : uid, timezone, list        (lang opsional)
 * - Wajib per record  : uigf_gacha_type, gacha_type, item_id, time, id
 * - Opsional per rec. : count, name, item_type, rank_type
 * - Hanya `info` yang wajib ada di level teratas.
 * - `time` HARUS string apa adanya dari API. Jangan pernah dikonversi ke Date —
 *   itu waktu server, dan konversi akan menggeser tanggalnya.
 * - `uid` dan `export_timestamp` boleh string maupun integer, jadi importer
 *   wajib menerima keduanya.
 */

import { UIGF_GACHA_TYPE_MAP } from "../config/gacha";
import { SUPPORTED_LANGS } from "../config/api";
import type { UigfGachaType, WishRecord } from "../types/wish";
import { dedupeAndSort, normalizeGachaType } from "./pity";

/** Versi yang kita tulis saat export. */
export const UIGF_VERSION = "v4.2";

export const UIGF_APP_NAME = "genshin-pity-tracker";

// ---------------------------------------------------------------------------
// Bentuk dokumen
// ---------------------------------------------------------------------------

export interface UigfInfo {
  export_timestamp: number;
  export_app: string;
  export_app_version: string;
  version: string;
}

export interface UigfRecord {
  uigf_gacha_type: string;
  gacha_type: string;
  item_id: string;
  time: string;
  id: string;
  count?: string;
  name?: string;
  item_type?: string;
  rank_type?: string;
}

export interface UigfAccount {
  uid: string;
  timezone: number;
  lang?: string;
  list: UigfRecord[];
}

export interface UigfDocument {
  info: UigfInfo;
  hk4e?: UigfAccount[];
}

export interface ExportAccountInput {
  uid: string;
  records: readonly WishRecord[];
  /** Kalau tidak diisi, ditebak dari UID. */
  timezone?: number;
  lang?: string;
}

export interface ExportOptions {
  appVersion: string;
  /** Detik sejak epoch. Wajib diberikan supaya hasil export bisa direproduksi di test. */
  exportTimestamp: number;
  appName?: string;
}

// ---------------------------------------------------------------------------
// Zona waktu
// ---------------------------------------------------------------------------

/**
 * Tebak offset zona waktu server dari UID.
 *
 * Standar UIGF mewajibkan `timezone` tapi tidak menjelaskan cara mendapatkannya —
 * memang tidak dikirim server. Konvensi komunitas: tebak dari digit awal UID.
 *   6 / 16  -> America  (UTC-5)
 *   7 / 17  -> Europe   (UTC+1)
 *   8 / 18  -> Asia     (UTC+8)
 *   9 / 19  -> TW/HK/MO (UTC+8)
 *   sisanya -> China    (UTC+8)
 */
export function timezoneForUid(uid: string): number {
  const digits = String(uid).trim().replace(/\D/g, "");
  if (!digits) return 8;
  const head = digits.length >= 10 ? digits.slice(0, 2) : digits.slice(0, 1);
  switch (head) {
    case "6":
    case "16":
      return -5;
    case "7":
    case "17":
      return 1;
    default:
      return 8;
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Susun dokumen UIGF dari data satu atau beberapa akun. */
export function buildUigfDocument(
  accounts: readonly ExportAccountInput[],
  options: ExportOptions,
): UigfDocument {
  const hk4e: UigfAccount[] = accounts.map((account) => {
    const uid = String(account.uid).trim();
    const entry: UigfAccount = {
      uid,
      timezone: account.timezone ?? timezoneForUid(uid),
      list: dedupeAndSort([...account.records]).map(toUigfRecord),
    };
    const lang = account.lang && SUPPORTED_LANGS.includes(account.lang) ? account.lang : "en-us";
    entry.lang = lang;
    return entry;
  });

  return {
    info: {
      export_timestamp: options.exportTimestamp,
      export_app: options.appName ?? UIGF_APP_NAME,
      export_app_version: options.appVersion,
      version: UIGF_VERSION,
    },
    hk4e,
  };
}

function toUigfRecord(record: WishRecord): UigfRecord {
  const out: UigfRecord = {
    uigf_gacha_type: normalizeGachaType(record.gacha_type),
    gacha_type: String(record.gacha_type),
    // API sering mengirim item_id kosong. Schema hk4e mewajibkan field-nya ada,
    // tapi tidak mewajibkan isinya — string kosong tetap valid.
    item_id: String(record.item_id ?? ""),
    time: String(record.time),
    id: String(record.id),
  };
  if (record.count !== undefined) out.count = String(record.count);
  if (record.name !== undefined) out.name = String(record.name);
  if (record.item_type !== undefined) out.item_type = String(record.item_type);
  if (record.rank_type !== undefined) out.rank_type = String(record.rank_type);
  return out;
}

/** Dokumen UIGF sebagai teks JSON, siap diunduh. */
export function serializeUigf(document: UigfDocument): string {
  return JSON.stringify(document, null, 2);
}

/** Nama file yang menjelaskan dirinya sendiri. */
export function suggestExportFilename(uid: string, dateStamp: string): string {
  return `UIGF4_${uid}_${dateStamp}.json`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type UigfParseErrorKind =
  | "invalid_json"
  | "not_uigf"
  | "unsupported_version"
  | "no_genshin_data";

export class UigfParseError extends Error {
  readonly kind: UigfParseErrorKind;
  readonly userMessage: string;

  constructor(kind: UigfParseErrorKind, userMessage: string) {
    super(userMessage);
    this.name = "UigfParseError";
    this.kind = kind;
    this.userMessage = userMessage;
  }
}

export interface ParsedUigfAccount {
  uid: string;
  timezone: number;
  lang: string;
  records: WishRecord[];
}

export interface ParsedUigf {
  accounts: ParsedUigfAccount[];
  /** Catatan yang layak ditampilkan, mis. record tanpa rank_type. */
  warnings: string[];
  exportApp: string;
  version: string;
}

/**
 * Baca file UIGF v4.x dari tool mana pun.
 *
 * Sikap dasarnya permisif: field opsional yang hilang tidak boleh membuat import
 * gagal. Yang benar-benar wajib hanya `id` dan `gacha_type` — tanpa keduanya
 * satu record tidak bisa ditempatkan di banner mana pun.
 */
export function parseUigf(text: string): ParsedUigf {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new UigfParseError(
      "invalid_json",
      "File-nya tidak bisa dibaca. Pastikan yang kamu pilih benar-benar file JSON hasil export, bukan file lain.",
    );
  }

  if (!isRecord(raw)) {
    throw new UigfParseError("not_uigf", "Isi file-nya tidak berbentuk data UIGF.");
  }

  const info = raw["info"];
  if (!isRecord(info)) {
    throw new UigfParseError(
      "not_uigf",
      "File ini tidak punya bagian info UIGF, jadi kami tidak yakin ini file wish history.",
    );
  }

  const version = String(info["version"] ?? "");
  if (!/^v4\./.test(version)) {
    throw new UigfParseError(
      "unsupported_version",
      version
        ? `File ini berformat UIGF ${version}, sedangkan yang kami dukung UIGF v4.x. Export ulang dari tool asalnya dengan format v4.`
        : "Versi UIGF file ini tidak tertulis, jadi kami tidak berani menebaknya.",
    );
  }

  const hk4e = raw["hk4e"];
  if (!Array.isArray(hk4e) || hk4e.length === 0) {
    throw new UigfParseError(
      "no_genshin_data",
      "File ini valid, tapi tidak memuat data Genshin Impact di dalamnya.",
    );
  }

  const warnings: string[] = [];
  const accounts: ParsedUigfAccount[] = [];
  let missingRank = 0;
  let skipped = 0;

  for (const entry of hk4e) {
    if (!isRecord(entry)) continue;
    const uid = String(entry["uid"] ?? "").trim();
    if (!uid) continue;

    const list = Array.isArray(entry["list"]) ? entry["list"] : [];
    const records: WishRecord[] = [];

    for (const item of list) {
      if (!isRecord(item)) {
        skipped++;
        continue;
      }
      const id = String(item["id"] ?? "").trim();
      const gachaType = String(item["gacha_type"] ?? item["uigf_gacha_type"] ?? "").trim();
      if (!id || !gachaType) {
        skipped++;
        continue;
      }
      const rankType = item["rank_type"] === undefined ? "" : String(item["rank_type"]);
      if (!rankType) missingRank++;

      records.push({
        id,
        uid,
        gacha_type: gachaType,
        item_id: String(item["item_id"] ?? ""),
        count: String(item["count"] ?? "1"),
        time: String(item["time"] ?? ""),
        name: String(item["name"] ?? ""),
        lang: typeof entry["lang"] === "string" ? entry["lang"] : "en-us",
        item_type: String(item["item_type"] ?? ""),
        rank_type: rankType,
      });
    }

    accounts.push({
      uid,
      timezone: Number.isFinite(Number(entry["timezone"]))
        ? Number(entry["timezone"])
        : timezoneForUid(uid),
      lang: typeof entry["lang"] === "string" ? entry["lang"] : "en-us",
      records: dedupeAndSort(records),
    });
  }

  if (accounts.length === 0) {
    throw new UigfParseError(
      "no_genshin_data",
      "File ini valid, tapi tidak ada satu pun akun Genshin yang bisa dibaca di dalamnya.",
    );
  }

  if (missingRank > 0) {
    warnings.push(
      `${missingRank} pull tidak menyertakan info bintang, jadi perhitungan pity-nya bisa sedikit meleset.`,
    );
  }
  if (skipped > 0) {
    warnings.push(`${skipped} baris dilewati karena datanya tidak lengkap.`);
  }

  return {
    accounts,
    warnings,
    exportApp: String(info["export_app"] ?? "tidak diketahui"),
    version,
  };
}

// ---------------------------------------------------------------------------
// Validasi (dipakai test dan pemeriksaan sebelum unduh)
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Periksa dokumen terhadap field wajib UIGF v4.x. */
export function validateUigfDocument(document: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(document)) return [{ path: "", message: "bukan objek" }];

  const info = document["info"];
  if (!isRecord(info)) {
    issues.push({ path: "info", message: "wajib ada" });
  } else {
    for (const field of ["export_timestamp", "export_app", "export_app_version", "version"]) {
      if (info[field] === undefined) issues.push({ path: `info.${field}`, message: "wajib ada" });
    }
    const version = String(info["version"] ?? "");
    if (!/^v\d+\.\d+$/.test(version)) {
      issues.push({ path: "info.version", message: "harus berbentuk v{major}.{minor}" });
    }
    const timestamp = info["export_timestamp"];
    if (typeof timestamp !== "string" && !Number.isInteger(timestamp)) {
      issues.push({ path: "info.export_timestamp", message: "harus string atau integer" });
    }
  }

  const hk4e = document["hk4e"];
  if (hk4e === undefined) return issues;
  if (!Array.isArray(hk4e)) {
    issues.push({ path: "hk4e", message: "harus array" });
    return issues;
  }

  hk4e.forEach((account, accountIndex) => {
    const base = `hk4e[${accountIndex}]`;
    if (!isRecord(account)) {
      issues.push({ path: base, message: "harus objek" });
      return;
    }
    if (typeof account["uid"] !== "string" && !Number.isInteger(account["uid"])) {
      issues.push({ path: `${base}.uid`, message: "harus string atau integer" });
    }
    if (!Number.isInteger(account["timezone"])) {
      issues.push({ path: `${base}.timezone`, message: "harus integer" });
    }
    if (account["lang"] !== undefined && !SUPPORTED_LANGS.includes(String(account["lang"]))) {
      issues.push({ path: `${base}.lang`, message: "kode bahasa tidak dikenal" });
    }
    const list = account["list"];
    if (!Array.isArray(list)) {
      issues.push({ path: `${base}.list`, message: "harus array" });
      return;
    }

    list.forEach((item, itemIndex) => {
      const path = `${base}.list[${itemIndex}]`;
      if (!isRecord(item)) {
        issues.push({ path, message: "harus objek" });
        return;
      }
      for (const field of ["uigf_gacha_type", "gacha_type", "item_id", "time", "id"]) {
        if (typeof item[field] !== "string") {
          issues.push({ path: `${path}.${field}`, message: "wajib ada dan bertipe string" });
        }
      }
      const uigfType = String(item["uigf_gacha_type"] ?? "");
      if (uigfType && !isUigfGachaType(uigfType)) {
        issues.push({ path: `${path}.uigf_gacha_type`, message: `nilai ${uigfType} tidak dikenal` });
      }
      const gachaType = String(item["gacha_type"] ?? "");
      if (gachaType && UIGF_GACHA_TYPE_MAP[gachaType] === undefined) {
        issues.push({ path: `${path}.gacha_type`, message: `nilai ${gachaType} tidak dikenal` });
      }
      const id = String(item["id"] ?? "");
      if (id && !/^[0-9]{1,19}$/.test(id)) {
        issues.push({ path: `${path}.id`, message: "harus 1-19 digit angka" });
      }
      const time = String(item["time"] ?? "");
      if (time && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)) {
        issues.push({ path: `${path}.time`, message: "harus YYYY-MM-DD HH:MM:SS" });
      }
    });
  });

  return issues;
}

function isUigfGachaType(value: string): value is UigfGachaType {
  return value === "100" || value === "200" || value === "301" || value === "302" || value === "500";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
