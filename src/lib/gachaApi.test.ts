/**
 * Acceptance criteria 9-14 (import) plus test pendukung.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE, RETCODE } from "../config/api";
import {
  WishImportError,
  fetchWishHistory,
  parseWishUrl,
  redactAuthkey,
  type ImportProgress,
  type ParsedWishUrl,
} from "./gachaApi";
import { computeBannerPity } from "./pity";
import { resetIdCursor } from "../test/fixtures";

const AUTHKEY = "yT2vXk9RAHASIAsangatPanjang%3D%3D";
const ENDPOINT = "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog";
const WISH_URL =
  `${ENDPOINT}?authkey_ver=1&sign_type=2&auth_appid=webview_gacha&authkey=${AUTHKEY}` +
  `&lang=en-us&game_biz=hk4e_global&gacha_type=301&page=1&size=20&end_id=0`;
const WORKER = "https://proxy.example.com";

const noSleep = async (_ms: number): Promise<void> => {};

/** Menangkap error import dengan tipe yang benar. */
async function grabError(promise: Promise<unknown>): Promise<WishImportError> {
  try {
    await promise;
  } catch (error) {
    return error as WishImportError;
  }
  throw new Error("seharusnya melempar error");
}

beforeEach(() => {
  resetIdCursor();
});

// ---------------------------------------------------------------------------
// Server tiruan
// ---------------------------------------------------------------------------

interface FakeServerOptions {
  /** Riwayat per kode banner mentah, urut NAIK (paling lama dulu). */
  history?: Record<string, Array<{ id: string; rank?: string; name?: string }>>;
  /** Antrean retcode yang dipaksakan sebelum respons normal. */
  forcedRetcodes?: number[];
  uid?: string;
  region?: string;
}

interface FakeServer {
  fetch: ReturnType<typeof vi.fn>;
  requests: Array<{ url: string; body: { endpoint: string; params: Record<string, string> } }>;
}

/**
 * Meniru getGachaLog: mengembalikan halaman berisi maksimal 20 record,
 * urut TURUN (paling baru dulu), dengan cursor end_id seperti aslinya.
 */
function makeFakeServer(options: FakeServerOptions = {}): FakeServer {
  const { history = {}, forcedRetcodes = [], uid = "800000001", region = "os_asia" } = options;
  const queue = [...forcedRetcodes];
  const requests: FakeServer["requests"] = [];

  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      endpoint: string;
      params: Record<string, string>;
    };
    requests.push({ url: String(url), body });

    const forced = queue.shift();
    if (forced !== undefined && forced !== RETCODE.OK) {
      return new Response(JSON.stringify({ retcode: forced, message: "forced" }), { status: 200 });
    }

    const gachaType = body.params["gacha_type"]!;
    const endId = body.params["end_id"] ?? "0";
    const all = [...(history[gachaType] ?? [])].reverse(); // turun: terbaru dulu

    const startIndex = endId === "0" ? 0 : all.findIndex((r) => r.id === endId) + 1;
    const page = all.slice(startIndex, startIndex + PAGE_SIZE).map((row) => ({
      uid,
      gacha_type: gachaType,
      item_id: "",
      count: "1",
      time: "2026-01-01 12:00:00",
      name: row.name ?? "Sacrificial Bow",
      lang: "en-us",
      item_type: "Weapon",
      rank_type: row.rank ?? "3",
      id: row.id,
    }));

    return new Response(
      JSON.stringify({ retcode: 0, message: "OK", data: { page: "1", size: "20", region, list: page } }),
      { status: 200 },
    );
  });

  return { fetch: fetchMock as unknown as FakeServer["fetch"], requests };
}

/** Deret id 19 digit yang menaik. */
function ids(count: number, offset = 0): string[] {
  return Array.from({ length: count }, (_, i) => String(1637787960000000000n + BigInt(offset + i + 1)));
}

function rows(count: number, offset = 0): Array<{ id: string }> {
  return ids(count, offset).map((id) => ({ id }));
}

function parsed(): ParsedWishUrl {
  return parseWishUrl(WISH_URL);
}

// ---------------------------------------------------------------------------
// Parsing URL
// ---------------------------------------------------------------------------

describe("parseWishUrl", () => {
  it("mengambil authkey, endpoint, lang, dan game_biz dari URL lengkap", () => {
    const result = parseWishUrl(WISH_URL);

    expect(result.endpoint).toBe(ENDPOINT);
    expect(result.authkey).toBe(decodeURIComponent(AUTHKEY));
    expect(result.lang).toBe("en-us");
    expect(result.gameBiz).toBe("hk4e_global");
  });

  it("endpoint diambil dari URL yang ditempel, bukan dari konstanta", () => {
    const pindah = WISH_URL.replace(
      "public-operation-hk4e-sg.hoyoverse.com/gacha_info/api",
      "hk4e-api-os.hoyoverse.com/event/gacha_info/api",
    );

    expect(parseWishUrl(pindah).endpoint).toBe(
      "https://hk4e-api-os.hoyoverse.com/event/gacha_info/api/getGachaLog",
    );
  });

  it("URL webview dengan parameter setelah tanda pagar tetap terbaca", () => {
    const webview = `https://webstatic-sea.hoyoverse.com/genshin/event/e20190909gacha/index.html?authkey_ver=1#/log?authkey=${AUTHKEY}&lang=en-us`;

    const result = parseWishUrl(webview);

    expect(result.authkey).toBe(decodeURIComponent(AUTHKEY));
    expect(result.endpoint).toBe(ENDPOINT);
  });

  it("URL server China memakai endpoint China", () => {
    const cn = `https://webstatic.mihoyo.com/hk4e/event/e20190909gacha/index.html?authkey=${AUTHKEY}`;

    expect(parseWishUrl(cn).endpoint).toBe(
      "https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog",
    );
  });

  it("lang yang tidak lengkap dinormalisasi", () => {
    expect(parseWishUrl(WISH_URL.replace("lang=en-us", "lang=en")).lang).toBe("en-us");
    expect(parseWishUrl(WISH_URL.replace("lang=en-us", "lang=xx-yy")).lang).toBe("en-us");
  });

  it("host yang bukan milik HoYoverse ditolak", () => {
    const jahat = `https://jahat.example.com/gacha_info/api/getGachaLog?authkey=${AUTHKEY}`;

    expect(() => parseWishUrl(jahat)).toThrowError(
      expect.objectContaining({ kind: "host_not_allowed" }),
    );
  });

  it("redactAuthkey menyembunyikan authkey dari teks apa pun", () => {
    const redacted = redactAuthkey(WISH_URL);

    expect(redacted).not.toContain("RAHASIA");
    expect(redacted).toContain("authkey=***");
  });
});

// ---------------------------------------------------------------------------
// Kriteria 9 - import normal
// ---------------------------------------------------------------------------

describe("kriteria 9: URL valid menarik seluruh banner", () => {
  it("authkey terekstrak, semua banner ditarik, progress bergerak", async () => {
    const server = makeFakeServer({
      history: {
        "301": rows(25),
        "400": rows(5, 100),
        "302": rows(3, 200),
        "200": rows(2, 300),
        "500": [],
        "100": [],
      },
    });

    const progress: ImportProgress[] = [];
    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      onProgress: (p) => progress.push({ ...p }),
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(result.records).toHaveLength(35);
    expect(result.uid).toBe("800000001");
    expect(result.region).toBe("os_asia");
    expect(result.perType).toMatchObject({ "301": 25, "400": 5, "302": 3, "200": 2, "500": 0, "100": 0 });

    // Setiap banner tersentuh, dan authkey ikut terkirim di body.
    const typesRequested = new Set(server.requests.map((r) => r.body.params["gacha_type"]));
    expect(typesRequested).toEqual(new Set(["100", "200", "301", "400", "302", "500"]));
    expect(server.requests[0]!.body.params["authkey"]).toBe(decodeURIComponent(AUTHKEY));

    // Progress naik dan berakhir di jumlah akhir.
    expect(progress.length).toBeGreaterThan(5);
    expect(progress.at(-1)!.fetched).toBe(35);
    expect(progress.some((p) => p.bannerName === "Banner Karakter")).toBe(true);
  });

  it("hasilnya terurut naik berdasarkan id dan langsung bisa dihitung pity-nya", async () => {
    const history = rows(30).map((r, i) => ({ ...r, rank: i === 9 ? "5" : "3", name: i === 9 ? "Qiqi" : "Bow" }));
    const server = makeFakeServer({ history: { "301": history } });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(result.records.map((r) => r.id)).toEqual([...result.records].map((r) => r.id).sort());

    const state = computeBannerPity(result.records, "301");
    expect(state.totalPulls).toBe(30);
    expect(state.pity).toBe(20);
    expect(state.guaranteed).toBe(true);
  });

  it("pagination berhenti saat halaman kosong dan memakai end_id sebagai cursor", async () => {
    const server = makeFakeServer({ history: { "301": rows(45) } });

    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    // 45 record = 20 + 20 + 5, halaman ketiga tidak penuh jadi berhenti di situ.
    expect(server.requests).toHaveLength(3);
    expect(server.requests[0]!.body.params["end_id"]).toBe("0");
    expect(server.requests[1]!.body.params["end_id"]).not.toBe("0");
    expect(server.requests.every((r) => r.body.params["size"] === "20")).toBe(true);
  });

  it("jeda antar request diterapkan, tapi tidak sebelum request pertama", async () => {
    const server = makeFakeServer({ history: { "301": rows(25) } });
    const sleep = vi.fn(async (_ms: number) => {});

    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep },
    });

    expect(server.requests).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]![0]).toBeGreaterThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 10 & 11 - error
// ---------------------------------------------------------------------------

describe("kriteria 10: URL tanpa authkey", () => {
  it("pesan ramah, tidak crash", () => {
    let caught: WishImportError | null = null;
    try {
      parseWishUrl(`${ENDPOINT}?lang=en-us&gacha_type=301`);
    } catch (error) {
      caught = error as WishImportError;
    }

    expect(caught).toBeInstanceOf(WishImportError);
    expect(caught!.kind).toBe("authkey_missing");
    expect(caught!.userMessage).toContain("authkey");
    expect(caught!.userMessage).not.toMatch(/retcode|-1\d\d/);
  });

  it("input kosong dan teks sembarang juga ditangani", () => {
    expect(() => parseWishUrl("")).toThrowError(expect.objectContaining({ kind: "empty_input" }));
    expect(() => parseWishUrl("   ")).toThrowError(expect.objectContaining({ kind: "empty_input" }));
    expect(() => parseWishUrl("halo aku bingung")).toThrowError(
      expect.objectContaining({ kind: "invalid_url" }),
    );
  });
});

describe("kriteria 11: authkey kedaluwarsa (retcode -101)", () => {
  it("pesannya menyebut masa berlaku 24 jam", async () => {
    const server = makeFakeServer({ forcedRetcodes: [RETCODE.AUTHKEY_TIMEOUT] });

    const promise = fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    const error = await grabError(promise);
    expect(error.kind).toBe("authkey_expired");
    expect(error.userMessage).toContain("24 jam");
    expect(error.userMessage).not.toContain("-101");
  });

  it("pesan authkey timeout tanpa retcode -101 tetap terdeteksi", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ retcode: -1, message: "authkey timeout" }), { status: 200 }),
    );

    await expect(
      fetchWishHistory({
        parsed: parsed(),
        workerUrl: WORKER,
        gachaTypes: ["301"],
        deps: { fetch: fetchMock as never, sleep: noSleep },
      }),
    ).rejects.toThrowError(expect.objectContaining({ kind: "authkey_expired" }));
  });

  it("retcode tak dikenal memberi pesan generik tanpa kode mentah", async () => {
    const server = makeFakeServer({ forcedRetcodes: [-9999] });

    const error = await grabError(
      fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
      }),
    );

    expect(error.kind).toBe("api");
    expect(error.userMessage).not.toContain("9999");
  });
});

// ---------------------------------------------------------------------------
// Kriteria 12 - rate limit
// ---------------------------------------------------------------------------

describe("kriteria 12: rate limit (retcode -110)", () => {
  it("backoff otomatis lalu lanjut, bukan gagal total", async () => {
    const server = makeFakeServer({
      history: { "301": rows(5) },
      forcedRetcodes: [RETCODE.VISIT_TOO_FREQUENT, RETCODE.VISIT_TOO_FREQUENT],
    });
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      waits.push(ms);
    });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep },
    });

    expect(result.records).toHaveLength(5);
    expect(server.requests).toHaveLength(3); // dua ditolak, satu berhasil
    // Jeda kedua lebih panjang dari yang pertama: backoff-nya eksponensial.
    expect(waits[1]).toBeGreaterThan(waits[0]!);
  });

  it("progress menandai kondisi throttled supaya UI bisa memberi tahu pengguna", async () => {
    const server = makeFakeServer({
      history: { "301": rows(2) },
      forcedRetcodes: [RETCODE.VISIT_TOO_FREQUENT],
    });
    const progress: ImportProgress[] = [];

    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      onProgress: (p) => progress.push({ ...p }),
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(progress.some((p) => p.throttled)).toBe(true);
  });

  it("rate limit yang tidak kunjung reda akhirnya menyerah dengan pesan ramah", async () => {
    const server = makeFakeServer({
      forcedRetcodes: Array.from({ length: 10 }, () => RETCODE.VISIT_TOO_FREQUENT),
    });

    const error = await grabError(
      fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
      }),
    );

    expect(error.kind).toBe("rate_limited");
    expect(error.userMessage).not.toContain("110");
  });

  it("gangguan jaringan sesaat dicoba ulang", async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error("network down");
      return new Response(JSON.stringify({ retcode: 0, data: { list: [] } }), { status: 200 });
    });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: fetchMock as never, sleep: noSleep },
    });

    expect(result.records).toHaveLength(0);
    expect(attempt).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 13 - import incremental
// ---------------------------------------------------------------------------

describe("kriteria 13: import kedua hanya menarik record baru", () => {
  it("berhenti di id yang sudah tersimpan, terverifikasi lewat jumlah request", async () => {
    const full = rows(45);
    const server = makeFakeServer({ history: { "301": full } });

    const first = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });
    const requestsFirst = server.requests.length;

    expect(first.records).toHaveLength(45);
    expect(requestsFirst).toBe(3);

    // Import kedua: tidak ada pull baru sama sekali.
    const second = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      since: { "301": full.at(-1)!.id },
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(second.records).toHaveLength(0);
    // Cukup satu request: halaman pertama langsung menyentuh id yang sudah dikenal.
    expect(server.requests.length - requestsFirst).toBe(1);
  });

  it("hanya pull yang benar-benar baru yang ditarik", async () => {
    const before = rows(45);
    const server = makeFakeServer({ history: { "301": [...before, ...rows(4, 45)] } });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      since: { "301": before.at(-1)!.id },
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(result.records).toHaveLength(4);
    expect(server.requests).toHaveLength(1);
  });

  it("cursor 301 dan 400 berdiri sendiri", async () => {
    const server = makeFakeServer({
      history: { "301": rows(3), "400": rows(3, 500) },
    });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301", "400"],
      since: { "301": ids(3).at(-1)! },
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    // 301 sudah lengkap, 400 masih kosong -> hanya record 400 yang masuk.
    expect(result.perType).toEqual({ "301": 0, "400": 3 });
  });
});

// ---------------------------------------------------------------------------
// Kriteria 14 - authkey tidak pernah tersimpan
// ---------------------------------------------------------------------------

describe("kriteria 14: authkey tidak pernah tersimpan", () => {
  it("tidak ada tulisan ke localStorage selama import", async () => {
    const setItem = vi.fn();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => {
        setItem(k, v);
        store.set(k, v);
      },
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });

    const server = makeFakeServer({ history: { "301": rows(3) } });
    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(setItem).not.toHaveBeenCalled();
    expect([...store.values()].join("")).not.toContain("RAHASIA");
    vi.unstubAllGlobals();
  });

  it("authkey tidak pernah muncul di URL request, hanya di body", async () => {
    const server = makeFakeServer({ history: { "301": rows(3) } });

    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    for (const request of server.requests) {
      expect(request.url).toBe(WORKER);
      expect(request.url).not.toContain("authkey");
      expect(request.url).not.toContain("RAHASIA");
    }
  });

  it("hasil import tidak memuat authkey di mana pun", async () => {
    const server = makeFakeServer({ history: { "301": rows(3) } });

    const result = await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("RAHASIA");
    expect(serialized.toLowerCase()).not.toContain("authkey");
  });

  it("objek progress tidak membawa authkey", async () => {
    const server = makeFakeServer({ history: { "301": rows(3) } });
    const progress: ImportProgress[] = [];

    await fetchWishHistory({
      parsed: parsed(),
      workerUrl: WORKER,
      gachaTypes: ["301"],
      onProgress: (p) => progress.push({ ...p }),
      deps: { fetch: server.fetch, sleep: noSleep },
    });

    expect(JSON.stringify(progress)).not.toContain("RAHASIA");
  });

  it("gachaApi.ts tidak menyentuh localStorage, sessionStorage, maupun indexedDB", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("./gachaApi.ts", import.meta.url)), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});

// ---------------------------------------------------------------------------
// Pembatalan
// ---------------------------------------------------------------------------

describe("pembatalan import", () => {
  it("signal yang sudah dibatalkan menghentikan import", async () => {
    const server = makeFakeServer({ history: { "301": rows(45) } });
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchWishHistory({
        parsed: parsed(),
        workerUrl: WORKER,
        gachaTypes: ["301"],
        signal: controller.signal,
        deps: { fetch: server.fetch, sleep: noSleep },
      }),
    ).rejects.toThrowError(expect.objectContaining({ name: "AbortError" }));

    expect(server.requests).toHaveLength(0);
  });

  it("worker yang belum dikonfigurasi memberi pesan jelas", async () => {
    await expect(
      fetchWishHistory({ parsed: parsed(), workerUrl: "", deps: { sleep: noSleep } }),
    ).rejects.toThrowError(expect.objectContaining({ kind: "worker_not_configured" }));
  });
});
