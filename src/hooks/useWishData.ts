/**
 * Satu sumber kebenaran untuk data wish di sisi UI: memuat dari IndexedDB,
 * menghitung pity, menjalankan import, dan menyimpan koreksi manual.
 *
 * Komponen tidak boleh menyentuh IndexedDB langsung — semuanya lewat sini.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getWorkerUrl } from "../config/api";
import {
  fetchWishHistory,
  parseWishUrl,
  type ImportProgress,
  type WishImportError,
} from "../lib/gachaApi";
import { computeAllPity, extractUids } from "../lib/pity";
import { getActiveUid, setActiveUid as persistActiveUid } from "../lib/prefs";
import {
  emptyAccountMeta,
  loadAccount,
  loadAllAccounts,
  loadWishes,
  mergeImport,
  openDatabase,
  saveAccount,
  type AccountMeta,
} from "../lib/storage";
import { parseUigf, type UigfParseError } from "../lib/uigf";
import type { BannerPityState, UigfGachaType, WishRecord } from "../types/wish";

export type ImportPhase = "idle" | "running" | "done" | "error";

export interface ImportState {
  phase: ImportPhase;
  progress: ImportProgress | null;
  /** Jumlah pull baru dari import terakhir yang berhasil. */
  added: number | null;
  errorMessage: string | null;
  warnings: string[];
}

const IDLE_IMPORT: ImportState = {
  phase: "idle",
  progress: null,
  added: null,
  errorMessage: null,
  warnings: [],
};

export interface WishData {
  ready: boolean;
  uids: string[];
  activeUid: string | null;
  records: WishRecord[];
  meta: AccountMeta;
  pity: Record<UigfGachaType, BannerPityState>;
  importState: ImportState;
  hasData: boolean;
  selectUid: (uid: string) => void;
  importFromUrl: (url: string) => Promise<boolean>;
  importFromUigfText: (text: string) => Promise<boolean>;
  setGuaranteedOverride: (bannerId: UigfGachaType, value: boolean | null) => Promise<void>;
  exportAll: () => Promise<Array<{ meta: AccountMeta; records: WishRecord[] }>>;
  cancelImport: () => void;
  resetImportState: () => void;
}

export function useWishData(): WishData {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [uids, setUids] = useState<string[]>([]);
  const [activeUid, setActiveUidState] = useState<string | null>(null);
  const [records, setRecords] = useState<WishRecord[]>([]);
  const [meta, setMeta] = useState<AccountMeta>(emptyAccountMeta(""));
  const [importState, setImportState] = useState<ImportState>(IDLE_IMPORT);
  const abortRef = useRef<AbortController | null>(null);

  // Buka database sekali, lalu tentukan UID mana yang ditampilkan.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const database = await openDatabase();
        if (cancelled) return;
        setDb(database);

        const accounts = await loadAllAccounts(database);
        if (cancelled) return;

        const availableUids = accounts.map((a) => a.meta.uid);
        setUids(availableUids);

        const remembered = getActiveUid();
        const initial =
          remembered && availableUids.includes(remembered) ? remembered : (availableUids[0] ?? null);
        setActiveUidState(initial);
      } catch {
        // Tanpa IndexedDB aplikasi tetap harus bisa dibuka — pengguna diarahkan
        // ke halaman import, bukan disuguhi layar putih.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(
    async (database: IDBDatabase, uid: string) => {
      const [loadedRecords, loadedMeta] = await Promise.all([
        loadWishes(database, uid),
        loadAccount(database, uid),
      ]);
      setRecords(loadedRecords);
      setMeta(loadedMeta);
    },
    [],
  );

  useEffect(() => {
    if (!db || !activeUid) {
      setRecords([]);
      setMeta(emptyAccountMeta(activeUid ?? ""));
      return;
    }
    void refresh(db, activeUid);
  }, [db, activeUid, refresh]);

  const selectUid = useCallback((uid: string) => {
    setActiveUidState(uid);
    persistActiveUid(uid);
  }, []);

  const pity = useMemo(
    () => computeAllPity(records, meta.guaranteedOverrides),
    [records, meta.guaranteedOverrides],
  );

  /** Simpan hasil import lalu segarkan tampilan. */
  const absorb = useCallback(
    async (
      database: IDBDatabase,
      uid: string,
      incoming: WishRecord[],
      extra: { region?: string | null; lang?: string | null; timezone?: number | null },
    ) => {
      const { added } = await mergeImport(database, uid, incoming, {
        at: new Date().toISOString(),
        ...extra,
      });

      const accounts = await loadAllAccounts(database);
      setUids(accounts.map((a) => a.meta.uid));
      setActiveUidState(uid);
      persistActiveUid(uid);
      await refresh(database, uid);
      return added;
    },
    [refresh],
  );

  const importFromUrl = useCallback(
    async (url: string): Promise<boolean> => {
      if (!db) {
        setImportState({
          ...IDLE_IMPORT,
          phase: "error",
          errorMessage:
            "Penyimpanan browser tidak bisa dibuka, jadi hasil import tidak akan tersimpan. Coba tanpa mode penyamaran.",
        });
        return false;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setImportState({ ...IDLE_IMPORT, phase: "running" });

      try {
        // authkey hidup hanya di dalam blok ini. Tidak pernah masuk state React,
        // karena state React bisa ikut terbaca lewat devtools.
        const parsed = parseWishUrl(url);
        const previous = activeUid ? await loadAccount(db, activeUid) : null;

        const result = await fetchWishHistory({
          parsed,
          workerUrl: getWorkerUrl(),
          since: previous?.latestIdByRawType ?? {},
          signal: controller.signal,
          onProgress: (progress) =>
            setImportState((current) => ({ ...current, phase: "running", progress })),
        });

        const uid = result.uid ?? activeUid;
        if (!uid) {
          setImportState({
            ...IDLE_IMPORT,
            phase: "done",
            added: 0,
            warnings: ["Tidak ada pull baru yang ditemukan."],
          });
          return true;
        }

        const added = await absorb(db, uid, result.records, {
          region: result.region,
          lang: parsed.lang,
        });

        setImportState({ ...IDLE_IMPORT, phase: "done", added });
        return true;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          setImportState(IDLE_IMPORT);
          return false;
        }
        setImportState({
          ...IDLE_IMPORT,
          phase: "error",
          errorMessage:
            (error as WishImportError)?.userMessage ??
            "Ada yang tidak beres saat menarik data. Coba lagi sebentar lagi.",
        });
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [db, activeUid, absorb],
  );

  const importFromUigfText = useCallback(
    async (text: string): Promise<boolean> => {
      if (!db) {
        setImportState({
          ...IDLE_IMPORT,
          phase: "error",
          errorMessage: "Penyimpanan browser tidak bisa dibuka, jadi file-nya tidak bisa disimpan.",
        });
        return false;
      }

      setImportState({ ...IDLE_IMPORT, phase: "running" });
      try {
        const parsed = parseUigf(text);
        let total = 0;
        let lastUid = activeUid;

        for (const account of parsed.accounts) {
          total += await absorb(db, account.uid, account.records, {
            timezone: account.timezone,
            lang: account.lang,
          });
          lastUid = account.uid;
        }

        if (lastUid) selectUid(lastUid);
        setImportState({
          ...IDLE_IMPORT,
          phase: "done",
          added: total,
          warnings: parsed.warnings,
        });
        return true;
      } catch (error) {
        setImportState({
          ...IDLE_IMPORT,
          phase: "error",
          errorMessage:
            (error as UigfParseError)?.userMessage ?? "File-nya tidak bisa dibaca sebagai UIGF.",
        });
        return false;
      }
    },
    [db, activeUid, absorb, selectUid],
  );

  const setGuaranteedOverride = useCallback(
    async (bannerId: UigfGachaType, value: boolean | null) => {
      if (!db || !activeUid) return;
      const overrides = { ...meta.guaranteedOverrides };
      if (value === null) delete overrides[bannerId];
      else overrides[bannerId] = value;

      const next = await saveAccount(db, activeUid, { guaranteedOverrides: overrides });
      setMeta(next);
    },
    [db, activeUid, meta.guaranteedOverrides],
  );

  const exportAll = useCallback(async () => {
    if (!db) return [];
    return loadAllAccounts(db);
  }, [db]);

  const cancelImport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setImportState(IDLE_IMPORT);
  }, []);

  const resetImportState = useCallback(() => setImportState(IDLE_IMPORT), []);

  return {
    ready,
    uids,
    activeUid,
    records,
    meta,
    pity,
    importState,
    hasData: records.length > 0 || extractUids(records).length > 0,
    selectUid,
    importFromUrl,
    importFromUigfText,
    setGuaranteedOverride,
    exportAll,
    cancelImport,
    resetImportState,
  };
}
