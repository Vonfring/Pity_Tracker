/**
 * Acceptance criteria 18-19 (multi-UID & persistensi) dan bagian IndexedDB
 * dari kriteria 14 (authkey tidak pernah tersimpan).
 *
 * IDBFactory tiruan dari fake-indexeddb, jadi tes ini benar-benar menjalankan
 * transaksi IndexedDB, bukan mock buatan sendiri.
 */

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteAccount,
  emptyAccountMeta,
  listUids,
  loadAccount,
  loadAllAccounts,
  loadWishes,
  mergeImport,
  openDatabase,
  saveAccount,
  saveWishes,
  wishKey,
} from "./storage";
import { computeBannerPity, latestIdByRawType } from "./pity";
import { filler, fiveStar, history, resetIdCursor } from "../test/fixtures";
import type { WishRecord } from "../types/wish";

let factory: IDBFactory;

beforeEach(() => {
  resetIdCursor();
  // Database baru tiap test — fake-indexeddb menyimpan state di dalam factory.
  factory = new IDBFactory();
});

function open() {
  return openDatabase(factory as unknown as globalThis.IDBFactory);
}

// ---------------------------------------------------------------------------
// Dasar
// ---------------------------------------------------------------------------

describe("penyimpanan dasar", () => {
  it("record tersimpan dan terbaca kembali dalam urutan id menaik", async () => {
    const db = await open();
    const records = history(filler(5, "301", { uid: "800000001" }));

    await saveWishes(db, "800000001", [...records].reverse());
    const loaded = await loadWishes(db, "800000001");

    expect(loaded).toHaveLength(5);
    expect(loaded.map((r) => r.id)).toEqual(records.map((r) => r.id));
  });

  it("menyimpan ulang record yang sama tidak menggandakan baris", async () => {
    const db = await open();
    const records = filler(10, "301", { uid: "800000001" });

    await saveWishes(db, "800000001", records);
    await saveWishes(db, "800000001", records);

    expect(await loadWishes(db, "800000001")).toHaveLength(10);
  });

  it("meta akun tersimpan dan punya nilai awal yang aman", async () => {
    const db = await open();

    expect(await loadAccount(db, "belum-ada")).toEqual(emptyAccountMeta("belum-ada"));

    await saveAccount(db, "800000001", {
      guaranteedOverrides: { "301": true },
      region: "os_asia",
    });
    const meta = await loadAccount(db, "800000001");

    expect(meta.guaranteedOverrides).toEqual({ "301": true });
    expect(meta.region).toBe("os_asia");
    expect(meta.lastImportAt).toBeNull();
  });

  it("kunci baris memuat UID supaya tidak mungkin bertabrakan antar akun", () => {
    expect(wishKey("800000001", "1637787960000000001")).toBe("800000001|1637787960000000001");
    expect(wishKey("600000002", "1637787960000000001")).not.toBe(
      wishKey("800000001", "1637787960000000001"),
    );
  });

  it("menghapus satu akun tidak menyentuh akun lain", async () => {
    const db = await open();
    await saveWishes(db, "800000001", filler(5, "301", { uid: "800000001" }));
    await saveWishes(db, "600000002", filler(7, "301", { uid: "600000002" }));
    await saveAccount(db, "800000001", {});
    await saveAccount(db, "600000002", {});

    await deleteAccount(db, "800000001");

    expect(await loadWishes(db, "800000001")).toHaveLength(0);
    expect(await loadWishes(db, "600000002")).toHaveLength(7);
    expect(await listUids(db)).toEqual(["600000002"]);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 18 - dua UID terpisah
// ---------------------------------------------------------------------------

describe("kriteria 18: dua UID tersimpan terpisah", () => {
  it("record dengan id sama di dua UID tidak saling menimpa", async () => {
    const db = await open();
    // Sengaja: id yang sama persis dipakai dua akun berbeda.
    const sharedIds = filler(4, "301", { uid: "800000001" });
    const cloned: WishRecord[] = sharedIds.map((r) => ({ ...r, uid: "600000002" }));

    await saveWishes(db, "800000001", sharedIds);
    await saveWishes(db, "600000002", cloned);

    expect(await loadWishes(db, "800000001")).toHaveLength(4);
    expect(await loadWishes(db, "600000002")).toHaveLength(4);
    expect((await loadWishes(db, "600000002")).every((r) => r.uid === "600000002")).toBe(true);
  });

  it("pity dua akun dihitung sendiri-sendiri", async () => {
    const db = await open();
    await mergeImport(db, "800000001", history(filler(12, "301", { uid: "800000001" })), {
      at: "2026-08-22T10:00:00.000Z",
    });
    await mergeImport(
      db,
      "600000002",
      history(filler(50, "301", { uid: "600000002" }), fiveStar("301", "Furina", { uid: "600000002" })),
      { at: "2026-08-22T10:00:00.000Z" },
    );

    expect(computeBannerPity(await loadWishes(db, "800000001"), "301").pity).toBe(12);
    expect(computeBannerPity(await loadWishes(db, "600000002"), "301").pity).toBe(0);
    expect(await listUids(db)).toEqual(["600000002", "800000001"]);
  });

  it("meta dan cursor incremental terpisah per UID", async () => {
    const db = await open();
    const first = filler(3, "301", { uid: "800000001" });
    const second = filler(3, "301", { uid: "600000002" });

    await mergeImport(db, "800000001", first, { at: "2026-08-22T10:00:00.000Z" });
    await mergeImport(db, "600000002", second, { at: "2026-08-22T11:00:00.000Z" });

    const a = await loadAccount(db, "800000001");
    const b = await loadAccount(db, "600000002");

    expect(a.latestIdByRawType["301"]).toBe(first.at(-1)!.id);
    expect(b.latestIdByRawType["301"]).toBe(second.at(-1)!.id);
    expect(a.lastImportAt).not.toBe(b.lastImportAt);
  });

  it("loadAllAccounts mengembalikan tiap akun beserta datanya", async () => {
    const db = await open();
    await mergeImport(db, "800000001", filler(2, "301", { uid: "800000001" }), {
      at: "2026-08-22T10:00:00.000Z",
    });
    await mergeImport(db, "600000002", filler(5, "302", { uid: "600000002" }), {
      at: "2026-08-22T10:00:00.000Z",
    });

    const all = await loadAllAccounts(db);

    expect(all.map((a) => a.meta.uid)).toEqual(["600000002", "800000001"]);
    expect(all[0]!.records).toHaveLength(5);
    expect(all[1]!.records).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 19 - data bertahan setelah reload
// ---------------------------------------------------------------------------

describe("kriteria 19: data masih ada setelah reload halaman", () => {
  it("koneksi database baru tetap melihat data lama", async () => {
    const first = await open();
    await mergeImport(first, "800000001", history(filler(20, "301", { uid: "800000001" })), {
      at: "2026-08-22T10:00:00.000Z",
      region: "os_asia",
    });
    first.close(); // meniru halaman ditutup

    const reopened = await open(); // meniru halaman dibuka lagi
    const records = await loadWishes(reopened, "800000001");
    const meta = await loadAccount(reopened, "800000001");

    expect(records).toHaveLength(20);
    expect(computeBannerPity(records, "301").pity).toBe(20);
    expect(meta.region).toBe("os_asia");
    expect(meta.lastImportAt).toBe("2026-08-22T10:00:00.000Z");
  });

  it("koreksi manual guaranteed ikut bertahan", async () => {
    const first = await open();
    await saveAccount(first, "800000001", { guaranteedOverrides: { "301": true } });
    first.close();

    const reopened = await open();
    expect((await loadAccount(reopened, "800000001")).guaranteedOverrides).toEqual({ "301": true });
  });
});

// ---------------------------------------------------------------------------
// Import incremental lewat penyimpanan
// ---------------------------------------------------------------------------

describe("mergeImport", () => {
  it("hanya menambah record yang benar-benar baru", async () => {
    const db = await open();
    const batch1 = filler(10, "301", { uid: "800000001" });
    const batch2 = filler(4, "301", { uid: "800000001" });

    const first = await mergeImport(db, "800000001", batch1, { at: "2026-08-22T10:00:00.000Z" });
    const second = await mergeImport(db, "800000001", [...batch1, ...batch2], {
      at: "2026-08-22T11:00:00.000Z",
    });

    expect(first.added).toBe(10);
    expect(second.added).toBe(4);
    expect(second.records).toHaveLength(14);
  });

  it("cursor per kode banner mentah cocok dengan perhitungan pity", async () => {
    const db = await open();
    const records = history(
      filler(5, "301", { uid: "800000001" }),
      filler(3, "400", { uid: "800000001" }),
      filler(2, "302", { uid: "800000001" }),
    );

    await mergeImport(db, "800000001", records, { at: "2026-08-22T10:00:00.000Z" });
    const meta = await loadAccount(db, "800000001");

    expect(meta.latestIdByRawType).toEqual(latestIdByRawType(records));
    // 301 dan 400 punya cursor sendiri-sendiri.
    expect(Object.keys(meta.latestIdByRawType).sort()).toEqual(["301", "302", "400"]);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 14 - bagian IndexedDB
// ---------------------------------------------------------------------------

describe("kriteria 14: authkey tidak pernah masuk IndexedDB", () => {
  it("field asing pada record dibuang sebelum ditulis", async () => {
    const db = await open();
    const tercemar = {
      ...filler(1, "301", { uid: "800000001" })[0]!,
      authkey: "RAHASIA-authkey-yang-tidak-boleh-tersimpan",
      token: "RAHASIA-lain",
    } as WishRecord;

    await saveWishes(db, "800000001", [tercemar]);
    const stored = await loadWishes(db, "800000001");

    expect(JSON.stringify(stored)).not.toContain("RAHASIA");
    expect(Object.keys(stored[0]!)).not.toContain("authkey");
  });

  it("seluruh isi database tidak memuat kata authkey", async () => {
    const db = await open();
    const tercemar = {
      ...filler(1, "301", { uid: "800000001" })[0]!,
      authkey: "RAHASIA",
    } as WishRecord;

    await mergeImport(db, "800000001", [tercemar], {
      at: "2026-08-22T10:00:00.000Z",
      region: "os_asia",
    });

    const dump = JSON.stringify(await loadAllAccounts(db));
    expect(dump).not.toContain("RAHASIA");
    expect(dump.toLowerCase()).not.toContain("authkey");
  });

  it("storage.ts tidak pernah menulis ke localStorage", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("./storage.ts", import.meta.url)), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/localStorage|sessionStorage/);
  });
});
