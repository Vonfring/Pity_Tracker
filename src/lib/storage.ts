/**
 * Penyimpanan lokal berbasis IndexedDB, dipisah per UID.
 *
 * Kenapa IndexedDB dan bukan localStorage: riwayat wish bisa ribuan baris.
 * localStorage hanya dipakai untuk preferensi kecil (lihat prefs.ts nanti).
 *
 * KEAMANAN: record yang ditulis ke disk disaring lewat sanitizeRecord() sehingga
 * hanya field WishRecord yang dikenal yang lolos. Kalaupun ada objek nyasar yang
 * membawa authkey, field itu tidak akan pernah sampai ke database.
 */

import type { GuaranteedOverrides, WishRecord } from "../types/wish";
import { compareWishId, dedupeAndSort } from "./pity";

export const DB_NAME = "genshin-pity-tracker";
export const DB_VERSION = 1;
export const STORE_WISHES = "wishes";
export const STORE_ACCOUNTS = "accounts";

/** Field yang boleh disimpan. Apa pun di luar daftar ini dibuang. */
const ALLOWED_RECORD_FIELDS = [
  "id",
  "uid",
  "gacha_type",
  "item_id",
  "count",
  "time",
  "name",
  "lang",
  "item_type",
  "rank_type",
] as const;

export interface AccountMeta {
  uid: string;
  /** id tertinggi per kode banner MENTAH — cursor untuk import incremental. */
  latestIdByRawType: Record<string, string>;
  /** Waktu import terakhir, ISO string. */
  lastImportAt: string | null;
  /** Koreksi manual status guaranteed dari pengguna. */
  guaranteedOverrides: GuaranteedOverrides;
  region: string | null;
  lang: string | null;
  timezone: number | null;
}

export function emptyAccountMeta(uid: string): AccountMeta {
  return {
    uid,
    latestIdByRawType: {},
    lastImportAt: null,
    guaranteedOverrides: {},
    region: null,
    lang: null,
    timezone: null,
  };
}

/** Kunci baris wish. UID ikut jadi bagian kunci supaya dua akun tidak pernah bertabrakan. */
export function wishKey(uid: string, id: string): string {
  return `${uid}|${id}`;
}

function getFactory(factory?: IDBFactory): IDBFactory {
  const resolved = factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!resolved) {
    throw new Error("IndexedDB tidak tersedia di lingkungan ini.");
  }
  return resolved;
}

export function openDatabase(factory?: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = getFactory(factory).open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_WISHES)) {
        const store = db.createObjectStore(STORE_WISHES, { keyPath: "key" });
        store.createIndex("uid", "uid", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        db.createObjectStore(STORE_ACCOUNTS, { keyPath: "uid" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka database."));
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operasi database gagal."));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transaksi gagal."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaksi dibatalkan."));
  });
}

/** Hanya field WishRecord yang dikenal yang boleh tersimpan. */
function sanitizeRecord(record: WishRecord, uid: string): Record<string, unknown> {
  const clean: Record<string, unknown> = { key: wishKey(uid, String(record.id)), uid };
  for (const field of ALLOWED_RECORD_FIELDS) {
    const value = record[field];
    if (value !== undefined) clean[field] = String(value);
  }
  clean["uid"] = uid;
  return clean;
}

function toWishRecord(row: Record<string, unknown>): WishRecord {
  return {
    id: String(row["id"] ?? ""),
    uid: String(row["uid"] ?? ""),
    gacha_type: String(row["gacha_type"] ?? ""),
    item_id: String(row["item_id"] ?? ""),
    count: String(row["count"] ?? "1"),
    time: String(row["time"] ?? ""),
    name: String(row["name"] ?? ""),
    lang: String(row["lang"] ?? ""),
    item_type: String(row["item_type"] ?? ""),
    rank_type: String(row["rank_type"] ?? ""),
  };
}

/**
 * Simpan record milik satu UID. Record dengan id yang sudah ada akan ditimpa,
 * jadi memanggil ini berkali-kali dengan data tumpang tindih tetap aman.
 */
export async function saveWishes(
  db: IDBDatabase,
  uid: string,
  records: readonly WishRecord[],
): Promise<number> {
  if (records.length === 0) return 0;
  const transaction = db.transaction(STORE_WISHES, "readwrite");
  const store = transaction.objectStore(STORE_WISHES);
  for (const record of records) {
    store.put(sanitizeRecord(record, uid));
  }
  await done(transaction);
  return records.length;
}

/** Seluruh record milik satu UID, terurut naik berdasarkan id. */
export async function loadWishes(db: IDBDatabase, uid: string): Promise<WishRecord[]> {
  const transaction = db.transaction(STORE_WISHES, "readonly");
  const index = transaction.objectStore(STORE_WISHES).index("uid");
  const rows = await promisify(index.getAll(uid));
  const records = (rows as Record<string, unknown>[]).map(toWishRecord);
  return records.sort((a, b) => compareWishId(a.id, b.id));
}

/** Daftar UID yang punya data tersimpan. */
export async function listUids(db: IDBDatabase): Promise<string[]> {
  const transaction = db.transaction(STORE_ACCOUNTS, "readonly");
  const keys = await promisify(transaction.objectStore(STORE_ACCOUNTS).getAllKeys());
  return (keys as IDBValidKey[]).map((k) => String(k)).sort();
}

export async function loadAccount(db: IDBDatabase, uid: string): Promise<AccountMeta> {
  const transaction = db.transaction(STORE_ACCOUNTS, "readonly");
  const row = await promisify(transaction.objectStore(STORE_ACCOUNTS).get(uid));
  if (!row) return emptyAccountMeta(uid);
  return { ...emptyAccountMeta(uid), ...(row as AccountMeta), uid };
}

export async function saveAccount(
  db: IDBDatabase,
  uid: string,
  patch: Partial<Omit<AccountMeta, "uid">>,
): Promise<AccountMeta> {
  const current = await loadAccount(db, uid);
  const next: AccountMeta = { ...current, ...patch, uid };
  const transaction = db.transaction(STORE_ACCOUNTS, "readwrite");
  transaction.objectStore(STORE_ACCOUNTS).put(next);
  await done(transaction);
  return next;
}

/**
 * Gabungkan hasil import ke data yang sudah tersimpan, lalu perbarui cursor
 * incremental. Mengembalikan seluruh record milik UID tersebut setelah digabung.
 */
export async function mergeImport(
  db: IDBDatabase,
  uid: string,
  incoming: readonly WishRecord[],
  meta: { region?: string | null; lang?: string | null; timezone?: number | null; at: string },
): Promise<{ records: WishRecord[]; added: number }> {
  const existing = await loadWishes(db, uid);
  const existingIds = new Set(existing.map((r) => r.id));
  const fresh = incoming.filter((r) => !existingIds.has(String(r.id)));

  await saveWishes(db, uid, fresh);
  const records = dedupeAndSort(existing, [...fresh]);

  const latestIdByRawType: Record<string, string> = {};
  for (const record of records) {
    const key = String(record.gacha_type).trim();
    const current = latestIdByRawType[key];
    if (!current || compareWishId(record.id, current) > 0) latestIdByRawType[key] = record.id;
  }

  await saveAccount(db, uid, {
    latestIdByRawType,
    lastImportAt: meta.at,
    ...(meta.region !== undefined ? { region: meta.region } : {}),
    ...(meta.lang !== undefined ? { lang: meta.lang } : {}),
    ...(meta.timezone !== undefined ? { timezone: meta.timezone } : {}),
  });

  return { records, added: fresh.length };
}

/** Hapus seluruh data satu UID. */
export async function deleteAccount(db: IDBDatabase, uid: string): Promise<void> {
  const transaction = db.transaction([STORE_WISHES, STORE_ACCOUNTS], "readwrite");
  const index = transaction.objectStore(STORE_WISHES).index("uid");
  const keys = await promisify(index.getAllKeys(uid));
  const store = transaction.objectStore(STORE_WISHES);
  for (const key of keys as IDBValidKey[]) store.delete(key);
  transaction.objectStore(STORE_ACCOUNTS).delete(uid);
  await done(transaction);
}

/** Seluruh isi database, untuk keperluan export lintas akun. */
export async function loadAllAccounts(
  db: IDBDatabase,
): Promise<Array<{ meta: AccountMeta; records: WishRecord[] }>> {
  const uids = await listUids(db);
  const result = [];
  for (const uid of uids) {
    result.push({ meta: await loadAccount(db, uid), records: await loadWishes(db, uid) });
  }
  return result;
}
