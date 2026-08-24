/**
 * Test proxy: logika bersama plus kedua adapter-nya
 * (Vercel Edge Function dan Cloudflare Worker).
 *
 * Keduanya dipanggil langsung sebagai fungsi — Request/Response sudah tersedia
 * di Node 22, jadi tidak perlu miniflare atau `vercel dev`.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import vercelHandler from "../../api/gacha";
import worker, { type Env } from "../../worker/src/index";
import { buildTargetUrl, handleGachaProxy } from "../../shared/gachaProxy";
import { ALLOWED_API_HOSTS } from "../config/api";

const ENDPOINT = "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog";
const EMPTY_ENV: Env = {};

function sourceOf(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request("https://contoh.example.com/api/gacha", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://pity.example.com" },
    body: JSON.stringify(body),
    ...init,
  });
}

function okUpstream(payload: unknown = { retcode: 0, message: "OK", data: { list: [] } }) {
  return vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200 }),
  );
}

// ---------------------------------------------------------------------------
// Validasi tujuan — inti keamanan proxy
// ---------------------------------------------------------------------------

describe("buildTargetUrl", () => {
  it("menerima endpoint resmi dan menyusun query dari params", () => {
    const result = buildTargetUrl({
      endpoint: ENDPOINT,
      params: { authkey: "RAHASIA", gacha_type: "301", page: 1 },
    });

    expect(result.ok).toBe(true);
    const url = new URL((result as { url: string }).url);
    expect(url.origin + url.pathname).toBe(ENDPOINT);
    expect(url.searchParams.get("authkey")).toBe("RAHASIA");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("menolak host di luar allowlist", () => {
    const result = buildTargetUrl({
      endpoint: "https://jahat.example.com/gacha_info/api/getGachaLog",
      params: {},
    });

    expect(result).toEqual({ ok: false, error: "endpoint_host_not_allowed" });
  });

  it("menerima seluruh host di allowlist, termasuk endpoint lama dan China", () => {
    for (const host of ALLOWED_API_HOSTS) {
      const result = buildTargetUrl({
        endpoint: `https://${host}/gacha_info/api/getGachaLog`,
        params: {},
      });
      expect(result.ok).toBe(true);
    }
  });

  it("menolak path yang bukan getGachaLog", () => {
    expect(
      buildTargetUrl({
        endpoint: "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getSomethingElse",
        params: {},
      }),
    ).toEqual({ ok: false, error: "endpoint_path_not_allowed" });
  });

  it("menolak http polos", () => {
    expect(buildTargetUrl({ endpoint: ENDPOINT.replace("https:", "http:"), params: {} })).toEqual({
      ok: false,
      error: "endpoint_not_https",
    });
  });

  it("query yang menempel di endpoint dibuang, tidak bisa dipakai menyuntik", () => {
    const result = buildTargetUrl({
      endpoint: `${ENDPOINT}?disuntik=1`,
      params: { gacha_type: "301" },
    });

    const url = new URL((result as { url: string }).url);
    expect(url.searchParams.get("disuntik")).toBeNull();
    expect(url.searchParams.get("gacha_type")).toBe("301");
  });

  it("menolak endpoint dan params yang cacat", () => {
    expect(buildTargetUrl({})).toEqual({ ok: false, error: "missing_endpoint" });
    expect(buildTargetUrl({ endpoint: "bukan url", params: {} })).toEqual({
      ok: false,
      error: "invalid_endpoint",
    });
    expect(buildTargetUrl({ endpoint: ENDPOINT })).toEqual({ ok: false, error: "missing_params" });
    expect(buildTargetUrl({ endpoint: ENDPOINT, params: [] })).toEqual({
      ok: false,
      error: "missing_params",
    });
    expect(buildTargetUrl({ endpoint: ENDPOINT, params: { x: { nested: true } } })).toEqual({
      ok: false,
      error: "invalid_param_type",
    });
  });
});

// ---------------------------------------------------------------------------
// Perilaku bersama, diuji lewat kedua adapter sekaligus
// ---------------------------------------------------------------------------

const ADAPTERS: Array<{ name: string; call: (request: Request) => Promise<Response> }> = [
  { name: "Vercel Edge Function", call: (request) => vercelHandler(request) },
  { name: "Cloudflare Worker", call: (request) => worker.fetch(request, EMPTY_ENV) },
];

describe.each(ADAPTERS)("adapter $name", ({ call }) => {
  it("meneruskan respons upstream apa adanya", async () => {
    const payload = { retcode: 0, message: "OK", data: { region: "os_asia", list: [] } };
    const stub = okUpstream(payload);
    vi.stubGlobal("fetch", stub);

    const response = await call(
      post({ endpoint: ENDPOINT, params: { authkey: "RAHASIA", gacha_type: "301" } }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(new URL(stub.mock.calls[0]![0]).searchParams.get("authkey")).toBe("RAHASIA");
    vi.unstubAllGlobals();
  });

  it("host asing ditolak tanpa pernah menghubungi upstream", async () => {
    const stub = okUpstream();
    vi.stubGlobal("fetch", stub);

    const response = await call(
      post({ endpoint: "https://jahat.example.com/gacha_info/api/getGachaLog", params: {} }),
    );

    expect(response.status).toBe(400);
    expect(stub).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("tidak meneruskan header apa pun dari klien ke upstream", async () => {
    const stub = okUpstream();
    vi.stubGlobal("fetch", stub);

    await call(
      post({ endpoint: ENDPOINT, params: {} }, {
        headers: {
          "Content-Type": "application/json",
          Cookie: "sesi=RAHASIA",
          Referer: "https://pity.example.com/?authkey=RAHASIA",
        },
      }),
    );

    const headers = (stub.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(["Accept", "User-Agent"]);
    vi.unstubAllGlobals();
  });

  it("respons tidak boleh di-cache", async () => {
    vi.stubGlobal("fetch", okUpstream());
    const response = await call(post({ endpoint: ENDPOINT, params: {} }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    vi.unstubAllGlobals();
  });

  it("upstream tidak terjangkau jadi 502 tanpa membocorkan URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`gagal menghubungi ${ENDPOINT}?authkey=RAHASIA`);
      }),
    );

    const response = await call(post({ endpoint: ENDPOINT, params: {} }));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("RAHASIA");
    expect(JSON.parse(text)).toEqual({ error: "upstream_unreachable" });
    vi.unstubAllGlobals();
  });

  it("body yang bukan JSON dan body kelewat besar ditolak", async () => {
    const bukanJson = await call(
      new Request("https://contoh.example.com/api/gacha", { method: "POST", body: "bukan json" }),
    );
    expect(bukanJson.status).toBe(400);

    const kebesaran = await call(
      new Request("https://contoh.example.com/api/gacha", {
        method: "POST",
        body: JSON.stringify({ endpoint: ENDPOINT, params: { x: "a".repeat(9000) } }),
      }),
    );
    expect(kebesaran.status).toBe(413);
  });

  it("metode selain POST ditolak", async () => {
    const response = await call(
      new Request("https://contoh.example.com/api/gacha", { method: "PUT" }),
    );
    expect(response.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Yang berbeda antar adapter
// ---------------------------------------------------------------------------

describe("Vercel Edge Function", () => {
  it("tidak mengirim header CORS sama sekali — request-nya same-origin", async () => {
    vi.stubGlobal("fetch", okUpstream());

    const response = await vercelHandler(post({ endpoint: ENDPOINT, params: {} }));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("dideklarasikan sebagai edge runtime", async () => {
    const module = await import("../../api/gacha");
    expect(module.config).toEqual({ runtime: "edge" });
  });

  it("GET dipakai sebagai health check", async () => {
    const response = await vercelHandler(
      new Request("https://contoh.example.com/api/gacha", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("Cloudflare Worker", () => {
  it("menjawab preflight dengan header CORS", async () => {
    const response = await worker.fetch(
      new Request("https://proxy.example.com/", { method: "OPTIONS" }),
      EMPTY_ENV,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("ALLOWED_ORIGINS membatasi origin yang dipantulkan", async () => {
    vi.stubGlobal("fetch", okUpstream());
    const env: Env = { ALLOWED_ORIGINS: "https://pity.example.com,https://lain.example.com" };

    const response = await worker.fetch(post({ endpoint: ENDPOINT, params: {} }), env);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://pity.example.com");
    expect(response.headers.get("Vary")).toBe("Origin");
    vi.unstubAllGlobals();
  });

  it("origin asing tidak dipantulkan balik", async () => {
    const response = await worker.fetch(
      new Request("https://proxy.example.com/", {
        method: "OPTIONS",
        headers: { Origin: "https://jahat.example.com" },
      }),
      { ALLOWED_ORIGINS: "https://pity.example.com" },
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://pity.example.com");
  });

  it("punya endpoint /health", async () => {
    const response = await worker.fetch(
      new Request("https://proxy.example.com/health", { method: "GET" }),
      EMPTY_ENV,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Keamanan & sumber tunggal
// ---------------------------------------------------------------------------

describe("keamanan proxy", () => {
  it("tidak ada console.* di seluruh jalur proxy", () => {
    for (const file of ["../../shared/gachaProxy.ts", "../../shared/apiHosts.ts", "../../api/gacha.ts", "../../worker/src/index.ts"]) {
      expect(stripComments(sourceOf(file))).not.toMatch(/console\s*\./);
    }
  });

  it("daftar host hanya ditulis sekali, di shared/apiHosts.ts", () => {
    const hostPattern = /"[a-z0-9.-]+\.(?:hoyoverse|mihoyo)\.com"/g;

    // Adapter tidak boleh punya salinan daftar host sendiri.
    expect(sourceOf("../../api/gacha.ts").match(hostPattern)).toBeNull();
    expect(sourceOf("../../worker/src/index.ts").match(hostPattern)).toBeNull();

    const shared = [...sourceOf("../../shared/apiHosts.ts").matchAll(hostPattern)].map((m) =>
      m[0].replaceAll('"', ""),
    );
    expect(shared).toEqual(ALLOWED_API_HOSTS);
  });

  it("wrangler.toml mematikan observability supaya authkey tidak masuk log", () => {
    expect(sourceOf("../../worker/wrangler.toml")).toMatch(
      /\[observability\][\s\S]*enabled\s*=\s*false/,
    );
  });

  it("handleGachaProxy tidak menyentuh penyimpanan apa pun", () => {
    const code = stripComments(sourceOf("../../shared/gachaProxy.ts"));
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|caches/);
    expect(typeof handleGachaProxy).toBe("function");
  });
});
