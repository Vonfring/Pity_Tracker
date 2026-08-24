/**
 * Satu-satunya tempat daftar host API HoYoverse ditulis.
 *
 * Dipakai oleh tiga sisi sekaligus: frontend (src/config/api.ts), Vercel Edge
 * Function (api/gacha.ts), dan Cloudflare Worker (worker/src/index.ts).
 * Sebelumnya daftar ini disalin di dua tempat dan dijaga oleh test agar tetap
 * kembar — sekarang tidak ada yang bisa berbeda karena sumbernya cuma satu.
 *
 * File ini sengaja hanya berisi konstanta, tanpa logika, supaya bisa diimpor
 * frontend tanpa ikut menyeret kode proxy ke dalam bundle browser.
 *
 * Diverifikasi Agustus 2026. Kalau HoYoverse memindahkan endpoint lagi,
 * tambahkan host baru di sini DAN endpoint lengkapnya di src/config/api.ts.
 */

/**
 * Host yang boleh dihubungi proxy.
 *
 * PENTING: tanpa allowlist, proxy berubah jadi open proxy yang bisa dipakai
 * siapa pun untuk menembak alamat sembarangan atas nama akunmu.
 */
export const ALLOWED_API_HOSTS: string[] = [
  "public-operation-hk4e-sg.hoyoverse.com",
  "hk4e-api-os.hoyoverse.com",
  "public-operation-hk4e.mihoyo.com",
  "hk4e-api.mihoyo.com",
];

/** Path endpoint wajib berakhir dengan ini. */
export const GACHA_LOG_PATH_MARKER = "getGachaLog";

export function isAllowedApiHost(host: string): boolean {
  return ALLOWED_API_HOSTS.includes(String(host).trim().toLowerCase());
}
