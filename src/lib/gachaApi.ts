/**
 * Penarikan riwayat wish: parsing URL, pagination, jeda antar request, retry.
 *
 * KEAMANAN: authkey hanya hidup di memori selama proses import berjalan.
 * Fungsi di file ini tidak pernah menulis ke localStorage/IndexedDB, tidak
 * pernah menaruh authkey di URL, dan tidak pernah mengembalikannya sebagai
 * bagian dari hasil import.
 */

import {
  GACHA_LOG_PATH_MARKER,
  GACHA_QUERY_DEFAULTS,
  NETWORK_RETRY,
  PAGE_SIZE,
  RATE_LIMIT_BACKOFF,
  REQUEST_DELAY_MS,
  RETCODE,
  SUPPORTED_LANGS,
  endpointForHost,
  isAllowedApiHost,
} from "../config/api";
import { BANNERS, FETCHABLE_GACHA_TYPES } from "../config/gacha";
import type { RawGachaType, WishRecord } from "../types/wish";
import { compareWishId, normalizeGachaType } from "./pity";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type ImportErrorKind =
  | "empty_input"
  | "invalid_url"
  | "authkey_missing"
  | "authkey_expired"
  | "authkey_invalid"
  | "rate_limited"
  | "host_not_allowed"
  | "worker_not_configured"
  | "network"
  | "api";

/**
 * Error import dengan pesan siap tampil.
 * `userMessage` selalu bahasa manusia — jangan pernah menampilkan retcode mentah.
 */
export class WishImportError extends Error {
  readonly kind: ImportErrorKind;
  readonly userMessage: string;

  constructor(kind: ImportErrorKind, userMessage: string, technical?: string) {
    super(technical ?? userMessage);
    this.name = "WishImportError";
    this.kind = kind;
    this.userMessage = userMessage;
  }
}

const MESSAGES: Record<ImportErrorKind, string> = {
  empty_input: "Link-nya masih kosong. Tempel dulu URL wish history-nya ya.",
  invalid_url:
    "Itu sepertinya bukan link yang benar. Pastikan kamu menempel seluruh teks hasil perintah PowerShell, dari https:// sampai habis.",
  authkey_missing:
    "Link-nya tidak memuat authkey. Biasanya ini terjadi kalau yang tertempel cuma sebagian. Coba jalankan ulang perintahnya, lalu tempel semuanya.",
  authkey_expired:
    "Link-nya sudah kedaluwarsa. Link wish history cuma berlaku sekitar 24 jam. Buka lagi Wish History di dalam game, jalankan ulang perintahnya, lalu tempel link yang baru.",
  authkey_invalid:
    "Authkey di link ini tidak dikenali. Coba buka Wish History di dalam game dulu, baru jalankan perintahnya lagi.",
  rate_limited:
    "HoYoverse sedang membatasi request. Sudah kami coba beberapa kali tapi belum lolos juga. Tunggu beberapa menit, lalu coba lagi.",
  host_not_allowed:
    "Alamat di link itu bukan alamat resmi HoYoverse, jadi tidak kami hubungi. Pastikan link-nya benar-benar dari game.",
  worker_not_configured:
    "Proxy belum diatur, jadi data tidak bisa ditarik. Isi VITE_WORKER_URL dulu (lihat worker/README.md).",
  network: "Koneksi ke server terputus. Cek internet kamu, lalu coba lagi.",
  api: "Server HoYoverse menolak permintaannya. Coba lagi beberapa saat lagi.",
};

function importError(kind: ImportErrorKind, technical?: string): WishImportError {
  return new WishImportError(kind, MESSAGES[kind], technical);
}

// ---------------------------------------------------------------------------
// Parsing URL
// ---------------------------------------------------------------------------

export interface ParsedWishUrl {
  /** origin + path endpoint getGachaLog. */
  endpoint: string;
  /** authkey dalam bentuk sudah ter-decode. JANGAN disimpan ke mana pun. */
  authkey: string;
  lang: string;
  /** Ikut disertakan kalau ada di URL asal — beberapa region membutuhkannya. */
  gameBiz?: string;
}

/**
 * Ambil authkey dan endpoint dari URL yang ditempel pengguna.
 *
 * Menerima dua bentuk:
 *   1. URL getGachaLog langsung (yang dihasilkan script PowerShell);
 *   2. URL webview wish history (parameternya bisa berada setelah tanda #).
 */
export function parseWishUrl(input: string): ParsedWishUrl {
  const raw = String(input ?? "").trim();
  if (!raw) throw importError("empty_input");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw importError("invalid_url");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw importError("invalid_url", `protokol ${url.protocol}`);
  }

  const params = collectParams(url);
  const authkey = params.get("authkey");
  if (!authkey) throw importError("authkey_missing");

  const host = url.hostname.toLowerCase();
  const isApiUrl = url.pathname.includes(GACHA_LOG_PATH_MARKER);
  const endpoint = isApiUrl ? `${url.origin}${url.pathname}` : endpointForHost(host);

  const endpointHost = new URL(endpoint).hostname;
  if (!isAllowedApiHost(endpointHost)) {
    throw importError("host_not_allowed", endpointHost);
  }

  const parsed: ParsedWishUrl = {
    endpoint,
    authkey,
    lang: normalizeLang(params.get("lang")),
  };
  const gameBiz = params.get("game_biz");
  if (gameBiz) parsed.gameBiz = gameBiz;
  return parsed;
}

/** Parameter bisa ada di query biasa maupun di belakang hash (URL webview). */
function collectParams(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search);
  const hash = url.hash;
  const questionMark = hash.indexOf("?");
  if (questionMark >= 0) {
    for (const [key, value] of new URLSearchParams(hash.slice(questionMark + 1))) {
      if (!merged.has(key)) merged.set(key, value);
    }
  }
  return merged;
}

function normalizeLang(lang: string | null): string {
  if (!lang) return GACHA_QUERY_DEFAULTS.lang;
  const lower = lang.toLowerCase();
  if (SUPPORTED_LANGS.includes(lower)) return lower;
  // "en" -> "en-us", "zh" -> "zh-cn", dst.
  const match = SUPPORTED_LANGS.find((l) => l.startsWith(`${lower}-`));
  return match ?? GACHA_QUERY_DEFAULTS.lang;
}

/**
 * Buang authkey dari sebuah URL supaya aman ditampilkan atau dicatat.
 * Dipakai untuk pesan error dan tampilan diagnostik.
 */
export function redactAuthkey(text: string): string {
  return String(text).replace(/authkey=[^&\s#]+/gi, "authkey=***");
}

// ---------------------------------------------------------------------------
// Pemanggilan API
// ---------------------------------------------------------------------------

export interface GachaLogResponse {
  retcode: number;
  message?: string;
  data?: {
    page?: string;
    size?: string;
    total?: string;
    region?: string;
    list?: WishRecord[];
  } | null;
}

export interface ImportProgress {
  /** Banner ke berapa dari total banner yang ditarik (1-indexed). */
  bannerIndex: number;
  bannerTotal: number;
  /** Nama banner yang sedang diproses, siap tampil. */
  bannerName: string;
  rawGachaType: string;
  page: number;
  /** Total record baru yang sudah terkumpul lintas banner. */
  fetched: number;
  /** Sedang menunggu backoff karena rate limit. */
  throttled: boolean;
}

export interface ImportDeps {
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface FetchWishHistoryOptions {
  parsed: ParsedWishUrl;
  /** URL Cloudflare Worker. */
  workerUrl: string;
  /**
   * Import incremental: id tertinggi yang sudah tersimpan, per kode banner MENTAH.
   * Penarikan satu banner berhenti begitu menyentuh id yang sudah ada.
   */
  since?: Record<string, string>;
  gachaTypes?: RawGachaType[];
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
  delayMs?: number;
  deps?: ImportDeps;
}

export interface ImportResult {
  /** Record baru, sudah terurut naik berdasarkan id. Tidak memuat authkey. */
  records: WishRecord[];
  uid: string | null;
  region: string | null;
  /** Jumlah record baru per kode banner mentah. */
  perType: Record<string, number>;
  /** Jumlah request yang dikirim — dipakai test untuk memverifikasi import incremental. */
  requests: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tarik seluruh riwayat wish.
 *
 * Aturan yang dijaga di sini:
 * - satu kode banner ditarik terpisah, halaman demi halaman;
 * - jeda minimal REQUEST_DELAY_MS antar request;
 * - retcode -110 tidak menggagalkan import, hanya memicu backoff lalu lanjut;
 * - retcode -101 langsung berhenti dengan pesan soal masa berlaku 24 jam.
 */
export async function fetchWishHistory(options: FetchWishHistoryOptions): Promise<ImportResult> {
  const {
    parsed,
    workerUrl,
    since = {},
    gachaTypes = FETCHABLE_GACHA_TYPES,
    onProgress,
    signal,
    delayMs = REQUEST_DELAY_MS,
    deps = {},
  } = options;

  if (!workerUrl) throw importError("worker_not_configured");

  const doFetch = deps.fetch ?? globalThis.fetch;
  const sleep = deps.sleep ?? defaultSleep;

  const records: WishRecord[] = [];
  const perType: Record<string, number> = {};
  let uid: string | null = null;
  let region: string | null = null;
  let requests = 0;
  let isFirstRequest = true;

  for (const [index, gachaType] of gachaTypes.entries()) {
    const bannerName = BANNERS[normalizeGachaType(gachaType)]?.name ?? `Banner ${gachaType}`;
    const sinceId = since[gachaType];
    let endId = "0";
    let page = 1;
    let typeCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      throwIfAborted(signal);

      onProgress?.({
        bannerIndex: index + 1,
        bannerTotal: gachaTypes.length,
        bannerName,
        rawGachaType: gachaType,
        page,
        fetched: records.length,
        throttled: false,
      });

      // Jeda WAJIB antar request. Request pertama tidak perlu menunggu.
      if (!isFirstRequest) await sleep(delayMs);
      isFirstRequest = false;

      const response = await requestPage({
        doFetch,
        sleep,
        signal,
        workerUrl,
        parsed,
        gachaType,
        page,
        endId,
        onThrottle: (waitMs) => {
          onProgress?.({
            bannerIndex: index + 1,
            bannerTotal: gachaTypes.length,
            bannerName,
            rawGachaType: gachaType,
            page,
            fetched: records.length,
            throttled: true,
          });
          return waitMs;
        },
      });
      requests += response.requests;

      const list = response.body.data?.list ?? [];
      if (response.body.data?.region && !region) region = response.body.data.region;
      if (list.length === 0) break;

      let reachedKnown = false;
      for (const record of list) {
        if (sinceId && compareWishId(record.id, sinceId) <= 0) {
          reachedKnown = true;
          break;
        }
        records.push(record);
        typeCount++;
        if (!uid && record.uid) uid = String(record.uid);
      }

      if (reachedKnown) break;

      const last = list[list.length - 1]!;
      endId = last.id;
      page++;

      // Halaman tidak penuh berarti sudah mentok — tidak perlu satu request lagi.
      if (list.length < PAGE_SIZE) break;
    }

    perType[gachaType] = typeCount;
  }

  onProgress?.({
    bannerIndex: gachaTypes.length,
    bannerTotal: gachaTypes.length,
    bannerName: "Selesai",
    rawGachaType: "",
    page: 0,
    fetched: records.length,
    throttled: false,
  });

  records.sort((a, b) => compareWishId(a.id, b.id));
  return { records, uid, region, perType, requests };
}

interface RequestPageArgs {
  doFetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  signal?: AbortSignal | undefined;
  workerUrl: string;
  parsed: ParsedWishUrl;
  gachaType: string;
  page: number;
  endId: string;
  onThrottle: (waitMs: number) => number;
}

/** Satu halaman, lengkap dengan retry untuk rate limit dan gangguan jaringan. */
async function requestPage(args: RequestPageArgs): Promise<{ body: GachaLogResponse; requests: number }> {
  const { doFetch, sleep, signal, workerUrl, parsed, gachaType, page, endId, onThrottle } = args;

  const payload = {
    endpoint: parsed.endpoint,
    params: {
      // authkey dikirim di body, bukan query string — supaya tidak masuk log akses.
      authkey: parsed.authkey,
      authkey_ver: GACHA_QUERY_DEFAULTS.authkey_ver,
      sign_type: GACHA_QUERY_DEFAULTS.sign_type,
      auth_appid: GACHA_QUERY_DEFAULTS.auth_appid,
      lang: parsed.lang,
      gacha_type: gachaType,
      page: String(page),
      size: String(PAGE_SIZE),
      end_id: endId,
      ...(parsed.gameBiz ? { game_biz: parsed.gameBiz } : {}),
    },
  };

  let rateLimitAttempt = 0;
  let networkAttempt = 0;
  let requests = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    throwIfAborted(signal);
    requests++;

    let body: GachaLogResponse;
    try {
      const response = await doFetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        ...(signal ? { signal } : {}),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      body = (await response.json()) as GachaLogResponse;
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (networkAttempt >= NETWORK_RETRY.maxRetries) {
        throw importError("network", (error as Error)?.message);
      }
      await sleep(backoffDelay(networkAttempt, NETWORK_RETRY));
      networkAttempt++;
      continue;
    }

    const retcode = Number(body?.retcode ?? 0);

    if (retcode === RETCODE.OK) return { body, requests };

    if (retcode === RETCODE.AUTHKEY_TIMEOUT || isAuthkeyTimeoutMessage(body?.message)) {
      throw importError("authkey_expired", `retcode ${retcode}`);
    }

    if (retcode === RETCODE.AUTHKEY_INVALID) {
      throw importError("authkey_invalid", `retcode ${retcode}`);
    }

    if (retcode === RETCODE.VISIT_TOO_FREQUENT) {
      if (rateLimitAttempt >= RATE_LIMIT_BACKOFF.maxRetries) {
        throw importError("rate_limited", `retcode ${retcode}`);
      }
      const wait = backoffDelay(rateLimitAttempt, RATE_LIMIT_BACKOFF);
      onThrottle(wait);
      await sleep(wait);
      rateLimitAttempt++;
      continue;
    }

    throw importError("api", `retcode ${retcode}`);
  }
}

interface BackoffConfig {
  readonly baseDelayMs: number;
  readonly factor: number;
  readonly maxDelayMs: number;
}

function backoffDelay(attempt: number, config: BackoffConfig): number {
  return Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(config.factor, attempt));
}

/**
 * Beberapa region mengirim pesan authkey timeout tanpa retcode -101.
 * Deteksi lewat pesan sebagai jaring pengaman.
 */
function isAuthkeyTimeoutMessage(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("authkey timeout") || lower.includes("authkey_timeout");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error("Import dibatalkan.");
    error.name = "AbortError";
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
