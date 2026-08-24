/**
 * Vercel Edge Function — proxy untuk API wish history HoYoverse.
 *
 * Alasan proxy ini ada: API HoYoverse tidak mengirim header CORS, jadi browser
 * menolak request langsung dari halaman web.
 *
 * Di Vercel, function ini berada di domain yang sama dengan aplikasinya
 * (`/api/gacha`), jadi request-nya same-origin — CORS tidak berlaku sama sekali
 * dan tidak ada header CORS yang perlu dikirim. Efek sampingnya bagus: proxy
 * ini tidak bisa dipakai halaman dari domain lain.
 *
 * Seluruh logikanya ada di shared/gachaProxy.ts, dipakai bersama dengan
 * Cloudflare Worker. Tidak ada console.* di sepanjang jalur ini — satu baris
 * log bisa membocorkan authkey.
 */

import { handleGachaProxy, jsonResponse } from "../shared/gachaProxy";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return jsonResponse({ ok: true }, 200);
  }
  return handleGachaProxy(request);
}
