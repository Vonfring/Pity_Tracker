/**
 * Cloudflare Worker — proxy CORS untuk API wish history HoYoverse.
 *
 * Adapter tipis di atas shared/gachaProxy.ts. Tugas khusus file ini cuma satu:
 * menambahkan header CORS, karena Worker berada di domain yang berbeda dari
 * aplikasinya. (Kalau kamu deploy semuanya ke Vercel, api/gacha.ts yang dipakai
 * dan CORS tidak diperlukan sama sekali.)
 *
 * Worker ini stateless: tidak menyimpan apa pun, tidak menulis log.
 * TIDAK ADA console.log di sini, sekali pun untuk debug — satu baris log bisa
 * membocorkan authkey atau UID.
 */

import { handleGachaProxy, jsonResponse } from "../../shared/gachaProxy";

export interface Env {
  /**
   * Daftar origin yang boleh memanggil worker, dipisah koma.
   * Kosong = izinkan semua (praktis untuk dev, WAJIB diisi saat produksi —
   * kalau tidak, halaman mana pun bisa memakai worker-mu sebagai proxy).
   */
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return jsonResponse({ ok: true }, 200, cors);
    }

    return handleGachaProxy(request, cors);
  },
};

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const requestOrigin = request.headers.get("Origin") ?? "";
  const configured = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowOrigin =
    configured.length === 0
      ? "*"
      : configured.includes(requestOrigin)
        ? requestOrigin
        : configured[0]!;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    ...(configured.length === 0 ? {} : { Vary: "Origin" }),
  };
}
