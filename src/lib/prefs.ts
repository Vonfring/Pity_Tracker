/**
 * Preferensi kecil di localStorage. Hanya untuk hal remeh seperti UID yang
 * terakhir dilihat — data wish tetap di IndexedDB.
 *
 * TIDAK PERNAH menyimpan authkey. Lihat storage.ts untuk data utamanya.
 */

const KEY_ACTIVE_UID = "gpt.activeUid";
const KEY_LOCALE = "gpt.locale";

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Mode privat di sebagian browser melempar error saat localStorage disentuh.
    return null;
  }
}

export function getActiveUid(): string | null {
  return safeStorage()?.getItem(KEY_ACTIVE_UID) ?? null;
}

export function setActiveUid(uid: string): void {
  try {
    safeStorage()?.setItem(KEY_ACTIVE_UID, uid);
  } catch {
    // Preferensi hilang bukan masalah besar; jangan sampai menggagalkan render.
  }
}

export function getLocale(): string | null {
  return safeStorage()?.getItem(KEY_LOCALE) ?? null;
}

export function setLocale(locale: string): void {
  try {
    safeStorage()?.setItem(KEY_LOCALE, locale);
  } catch {
    // sengaja diabaikan
  }
}

export function clearActiveUid(): void {
  try {
    safeStorage()?.removeItem(KEY_ACTIVE_UID);
  } catch {
    // sengaja diabaikan
  }
}
