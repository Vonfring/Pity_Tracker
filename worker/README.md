# Proxy CORS — Cloudflare Worker

Adapter Cloudflare untuk proxy wish history. Logikanya sendiri ada di [`../shared/gachaProxy.ts`](../shared/gachaProxy.ts) dan dipakai bersama dengan Vercel Edge Function di `api/gacha.ts`; file di sini hanya menambahkan header CORS.

> **Kalau kamu deploy semuanya ke Vercel, folder ini tidak dibutuhkan** untuk produksi — `api/gacha.ts` sudah same-origin, jadi CORS tidak berlaku. Folder ini tetap berguna untuk menjalankan proxy secara lokal saat `npm run dev`.

## Menjalankan lokal

```bash
npm install
npx wrangler dev --port 8787
```

Tidak perlu akun Cloudflare — `wrangler dev` memakai runtime lokal. Vite meneruskan `/api/gacha` ke port 8787, jadi jalur di dev sama persis dengan produksi.

## Kenapa ini perlu

API HoYoverse tidak mengirim header CORS, jadi browser menolak request langsung dari halaman web. Tanpa proxy, aplikasi ini tidak bisa menarik data sama sekali — dan itulah alasan aplikasi ini tidak bisa jadi static site murni.

Worker ini **stateless**: tidak menyimpan apa pun, tidak punya database, tidak menulis log.

## Deploy

```bash
cd worker
npm install
npx wrangler login       # sekali saja, membuka browser
npx wrangler deploy
```

Setelah deploy, wrangler mencetak URL worker, bentuknya seperti:

```
https://genshin-pity-proxy.<subdomain-kamu>.workers.dev
```

Salin URL itu ke file `.env` di root repo (bukan di folder `worker/`):

```
VITE_WORKER_URL=https://genshin-pity-proxy.subdomain-kamu.workers.dev
```

Lalu jalankan ulang `npm run dev`. Vite hanya membaca `.env` saat start.

## Membatasi siapa yang boleh memakai

Secara default worker menerima request dari origin mana pun (`ALLOWED_ORIGINS` kosong) — praktis saat dev, tapi artinya siapa pun bisa memakai worker kamu sebagai proxy. Saat produksi, isi origin situsmu di `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://pity.situskamu.com"
```

Beberapa origin dipisah koma. Deploy ulang setelah mengubahnya.

## Kontrak API

Satu endpoint, `POST /`:

```jsonc
{
  "endpoint": "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog",
  "params": {
    "authkey": "...",
    "authkey_ver": "1",
    "sign_type": "2",
    "auth_appid": "webview_gacha",
    "lang": "en-us",
    "gacha_type": "301",
    "page": "1",
    "size": "20",
    "end_id": "0"
  }
}
```

Responsnya adalah JSON dari HoYoverse apa adanya (`{ retcode, message, data }`).

Ada juga `GET /health` yang mengembalikan `{"ok":true}` — berguna untuk memastikan worker hidup.

### Kenapa POST dan bukan GET

authkey adalah kredensial. Kalau dikirim lewat query string, ia ikut masuk ke log akses, analytics, dan riwayat proxy di sepanjang jalur. Body request tidak dicatat, jadi authkey dikirim di sana.

## Yang dijaga worker ini

| Penjagaan | Alasan |
|---|---|
| Allowlist host tujuan | Tanpa ini worker jadi open proxy: siapa pun bisa menembak alamat sembarangan atas nama akun Cloudflare kamu |
| Path wajib berakhiran `getGachaLog` | Membatasi worker pada satu endpoint saja |
| Hanya `https` | Mencegah downgrade ke koneksi polos |
| Query di `endpoint` dibuang | Parameter tidak bisa disuntikkan lewat URL endpoint |
| Header klien tidak diteruskan | Cookie/Referer tidak dibutuhkan dan hanya menambah jejak |
| `Cache-Control: no-store` | Respons memuat data wish, jangan sampai singgah di cache |
| `[observability] enabled = false` | Logging Cloudflare akan mencatat request yang memuat authkey |
| Tanpa `console.*` | Satu baris log saja bisa membocorkan authkey — ada test yang menjaga ini |

## Memperbarui daftar host

Kalau HoYoverse memindahkan endpoint lagi:

1. Tambahkan host baru ke `ALLOWED_API_HOSTS` di [`../shared/apiHosts.ts`](../shared/apiHosts.ts) — itu satu-satunya daftar host, dipakai frontend, Vercel Function, dan Worker sekaligus.
2. Tambahkan endpoint lengkapnya ke `KNOWN_ENDPOINTS` di `../src/config/api.ts`.
3. Jalankan `npm test` di root.
4. Deploy ulang.

## Biaya

Free tier Cloudflare Workers memberi 100.000 request per hari. Satu import penuh untuk akun lama menghabiskan sekitar 30–80 request, jadi kuotanya sangat longgar untuk pemakaian pribadi.
