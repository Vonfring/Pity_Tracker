/**
 * Endpoint API dan seluruh knob jaringan.
 *
 * HoYoverse pernah memindahkan endpoint wish history, dan server China memakai
 * domain berbeda. Karena itu:
 *   1. origin + path SELALU diambil dari URL yang ditempel pengguna;
 *   2. daftar di bawah hanya dipakai sebagai cadangan kalau URL yang ditempel
 *      bukan URL getGachaLog (mis. pengguna menempel link webview wish history).
 *
 * Diverifikasi Agustus 2026:
 * - Global saat ini : https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog
 * - Global lama     : https://hk4e-api-os.hoyoverse.com/event/gacha_info/api/getGachaLog
 * - China saat ini  : https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog
 * - China lama      : https://hk4e-api.mihoyo.com/event/gacha_info/api/getGachaLog
 *
 * Cara memperbarui kalau HoYoverse pindah lagi: tambahkan entri baru di paling
 * atas KNOWN_ENDPOINTS, lalu tambahkan host-nya ke ALLOWED_API_HOSTS di
 * shared/apiHosts.ts. Daftar host itu satu-satunya, dipakai frontend maupun
 * kedua adapter proxy, jadi tidak ada salinan yang bisa ketinggalan.
 */

// Daftar host dan penanda path tinggal di shared/ karena dipakai bersama oleh
// frontend, Vercel Edge Function, dan Cloudflare Worker.
export {
  ALLOWED_API_HOSTS,
  GACHA_LOG_PATH_MARKER,
  isAllowedApiHost,
} from "../../shared/apiHosts";

export interface EndpointConfig {
  url: string;
  /** "os" = server global, "cn" = server China. */
  region: "os" | "cn";
  label: string;
}

/** Urutan menentukan prioritas: yang pertama dipakai lebih dulu. */
export const KNOWN_ENDPOINTS: EndpointConfig[] = [
  {
    url: "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog",
    region: "os",
    label: "Global (saat ini)",
  },
  {
    url: "https://hk4e-api-os.hoyoverse.com/event/gacha_info/api/getGachaLog",
    region: "os",
    label: "Global (lama)",
  },
  {
    url: "https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog",
    region: "cn",
    label: "China (saat ini)",
  },
  {
    url: "https://hk4e-api.mihoyo.com/event/gacha_info/api/getGachaLog",
    region: "cn",
    label: "China (lama)",
  },
];

/** Host webview wish history — bukan endpoint API, tapi URL-nya membawa authkey. */
export const WISH_WEBVIEW_HOST_HINTS: string[] = [
  "webstatic-sea.hoyoverse.com",
  "webstatic-sea.mihoyo.com",
  "webstatic.hoyoverse.com",
  "webstatic.mihoyo.com",
  "hk4e-api-os.hoyoverse.com",
  "hk4e-api.mihoyo.com",
];

/** Parameter query wajib untuk getGachaLog. */
export const GACHA_QUERY_DEFAULTS = {
  authkey_ver: "1",
  sign_type: "2",
  auth_appid: "webview_gacha",
  lang: "en-us",
} as const;

/** Maksimal 20 per halaman — dipaksa oleh API. */
export const PAGE_SIZE = 20;

/**
 * Jeda antar request. TIDAK OPSIONAL: tanpa jeda, HoYoverse memblokir dan
 * retcode berubah jadi -110. 500ms adalah batas bawah yang aman.
 */
export const REQUEST_DELAY_MS = 500;

/** Backoff eksponensial saat kena rate limit (-110). */
export const RATE_LIMIT_BACKOFF = {
  maxRetries: 5,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 30_000,
} as const;

/** Retry untuk kegagalan jaringan (bukan rate limit). */
export const NETWORK_RETRY = {
  maxRetries: 2,
  baseDelayMs: 800,
  factor: 2,
  maxDelayMs: 5_000,
} as const;

/** Timeout satu request ke proxy. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** retcode yang dikenal dari API HoYoverse. */
export const RETCODE = {
  OK: 0,
  /** authkey tidak valid / salah bentuk. */
  AUTHKEY_INVALID: -100,
  /** authkey kedaluwarsa — masa berlaku sekitar 24 jam. */
  AUTHKEY_TIMEOUT: -101,
  /** terlalu sering request. Backoff lalu lanjut, jangan gagal total. */
  VISIT_TOO_FREQUENT: -110,
} as const;

/** Bahasa yang diterima UIGF. Nilai lain dinormalisasi ke en-us. */
export const SUPPORTED_LANGS: string[] = [
  "de-de",
  "en-us",
  "es-es",
  "fr-fr",
  "id-id",
  "it-it",
  "ja-jp",
  "ko-kr",
  "pt-pt",
  "ru-ru",
  "th-th",
  "tr-tr",
  "vi-vn",
  "zh-cn",
  "zh-tw",
];

/**
 * Alamat proxy yang dipakai frontend.
 *
 * Default-nya same-origin (`/api/gacha`) — itu yang berlaku kalau seluruhnya
 * di-deploy ke Vercel, dan juga saat `npm run dev` karena Vite meneruskan path
 * itu ke worker lokal.
 *
 * Isi VITE_WORKER_URL hanya kalau proxy-nya berada di domain lain, mis. worker
 * Cloudflare yang di-deploy terpisah.
 */
export const DEFAULT_PROXY_PATH = "/api/gacha";

export function getWorkerUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_WORKER_URL"] as string | undefined)
      : undefined;
  const configured = (fromEnv ?? "").trim().replace(/\/+$/, "");
  return configured || DEFAULT_PROXY_PATH;
}

/** Endpoint cadangan untuk host tertentu, dipakai kalau URL yang ditempel bukan URL API. */
export function endpointForHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  const isCn = normalized.endsWith(".mihoyo.com");
  const fallback = KNOWN_ENDPOINTS.find((e) => e.region === (isCn ? "cn" : "os"));
  return (fallback ?? KNOWN_ENDPOINTS[0]!).url;
}

