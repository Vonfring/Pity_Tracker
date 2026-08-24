/**
 * Logika proxy wish history, dipakai bersama oleh Vercel Edge Function dan
 * Cloudflare Worker. Keduanya hanya adapter tipis di atas file ini.
 *
 * Ditulis dengan Web API standar (Request/Response/fetch), jadi jalan apa
 * adanya di kedua runtime tanpa polyfill.
 *
 * ATURAN KEAMANAN YANG TIDAK BISA DITAWAR:
 * 1. authkey adalah kredensial. Dikirim lewat BODY (POST), bukan query string,
 *    supaya tidak ikut tercatat di log akses/analytics mana pun.
 * 2. TIDAK ADA console.log / console.error di file ini. Sekali pun untuk debug.
 *    Satu baris log bisa membocorkan authkey atau UID.
 * 3. Host tujuan dibatasi allowlist di shared/apiHosts.ts.
 */

import { GACHA_LOG_PATH_MARKER, isAllowedApiHost } from "./apiHosts";

/** Batas ukuran body, sekadar penjaga kewarasan. */
export const MAX_BODY_BYTES = 8 * 1024;

/** Timeout ke upstream. */
export const UPSTREAM_TIMEOUT_MS = 20_000;

export interface ProxyRequestBody {
  endpoint?: unknown;
  params?: unknown;
}

export type TargetResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validasi body lalu susun URL tujuan.
 *
 * URL dibangun ulang dari nol — origin + path saja — supaya query yang
 * menempel di `endpoint` tidak bisa dipakai menyuntikkan parameter.
 */
export function buildTargetUrl(body: ProxyRequestBody): TargetResult {
  if (typeof body.endpoint !== "string" || body.endpoint.length === 0) {
    return { ok: false, error: "missing_endpoint" };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(body.endpoint);
  } catch {
    return { ok: false, error: "invalid_endpoint" };
  }

  if (endpoint.protocol !== "https:") {
    return { ok: false, error: "endpoint_not_https" };
  }
  if (!isAllowedApiHost(endpoint.hostname)) {
    return { ok: false, error: "endpoint_host_not_allowed" };
  }
  if (!endpoint.pathname.endsWith(GACHA_LOG_PATH_MARKER)) {
    return { ok: false, error: "endpoint_path_not_allowed" };
  }

  const params = body.params;
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    return { ok: false, error: "missing_params" };
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" && typeof value !== "number") {
      return { ok: false, error: "invalid_param_type" };
    }
    search.set(key, String(value));
  }

  const url = new URL(endpoint.origin + endpoint.pathname);
  url.search = search.toString();
  return { ok: true, url: url.toString() };
}

async function readBodyText(request: Request): Promise<string | null> {
  const declared = request.headers.get("Content-Length");
  if (declared && Number(declared) > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  return text;
}

export function jsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      // Respons memuat data wish — jangan sampai singgah di cache mana pun.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Tangani satu request proxy dari awal sampai akhir.
 *
 * `extraHeaders` dipakai adapter untuk menyisipkan header CORS. Di deployment
 * same-origin (Vercel), parameter ini kosong karena CORS memang tidak perlu.
 */
export async function handleGachaProxy(
  request: Request,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, extraHeaders);
  }

  const raw = await readBodyText(request);
  if (raw === null) {
    return jsonResponse({ error: "body_too_large" }, 413, extraHeaders);
  }

  let body: ProxyRequestBody;
  try {
    body = JSON.parse(raw) as ProxyRequestBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, extraHeaders);
  }

  const target = buildTargetUrl(body);
  if (!target.ok) {
    return jsonResponse({ error: target.error }, 400, extraHeaders);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.url, {
      method: "GET",
      headers: {
        // Header minimal. Jangan teruskan header apa pun dari klien —
        // Referer/Origin/Cookie tidak dibutuhkan dan hanya menambah jejak.
        Accept: "application/json",
        "User-Agent": "genshin-pity-tracker/1.0",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Sengaja tanpa detail: pesan error-nya bisa memuat URL lengkap + authkey.
    return jsonResponse({ error: "upstream_unreachable" }, 502, extraHeaders);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.ok ? 200 : 502,
    headers: {
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
