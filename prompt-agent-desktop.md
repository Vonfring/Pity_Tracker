# PROMPT — salin seluruh isi di bawah garis ini ke coding agent

---

Kamu akan membangun sebuah web app dari nol. Baca seluruh brief ini sampai habis sebelum menulis kode apa pun.

## Tugas

Bangun **Genshin Pity Tracker** — web app desktop yang menghitung pity secara otomatis dengan menarik riwayat wish langsung dari akun Genshin pengguna, lalu menampilkan status seluruh banner dalam satu layar.

Referensi fungsional: https://paimon.moe/wish dan repo https://github.com/MadeBaruna/paimon-moe

Perbedaan dari paimon.moe: paimon.moe adalah companion app lengkap (ascension calculator, todo, database). Produk ini **hanya** wish tracker. Jangan bangun fitur di luar itu.

## Platform: desktop-first

Pengguna membuka ini di PC yang sama dengan tempat mereka main Genshin — biasanya di monitor kedua atau alt-tab dari game. Ini mengubah beberapa keputusan desain secara mendasar:

- **Layout dioptimalkan untuk layar lebar.** Seluruh banner ditampilkan bersamaan, bukan satu per satu lewat tab. Pengguna tidak perlu mengklik untuk membandingkan pity karakter vs senjata.
- **Kepadatan informasi boleh tinggi.** Ruang layar tersedia, jadi manfaatkan. Tapi tetap ada satu hierarki visual yang jelas, bukan sekadar menumpuk data.
- **Import jauh lebih mudah di desktop** karena game dan browser ada di mesin yang sama. Ini keunggulan utama; rancang alur import untuk skenario ini.
- **Mobile:** cukup responsive supaya tidak rusak kalau dibuka di HP. Bukan prioritas, tidak perlu dioptimalkan.

Target lebar konten: 1280–1440px, dengan breakpoint turun ke satu kolom di bawah 768px.

## Target pengguna

Pemain kasual Genshin. Tidak hafal istilah "soft pity", "50/50", atau "Fate Point". Ingin keputusan praktis: pull sekarang, atau nabung dulu.

Konsekuensi terpenting: **proses import adalah rintangan terbesar.** Mengambil authkey butuh menjalankan perintah PowerShell. Banyak pengguna akan ragu atau menyerah di titik ini. Alur import wajib diperlakukan sebagai fitur utama yang dirancang serius, bukan form seadanya.

---

## ARSITEKTUR — baca sebelum memilih pendekatan

**API HoYoverse tidak mengirim header CORS.** Request langsung dari browser akan gagal. Aplikasi ini **tidak bisa** murni static site; kamu wajib membuat proxy.

- **Frontend:** React + TypeScript, Vite, Tailwind CSS
- **Proxy:** Cloudflare Worker (satu file, tanpa framework). Tugasnya hanya meneruskan request ke API HoYoverse dan menambahkan header CORS.
- **Penyimpanan:** IndexedDB di browser, dipisah per UID. Riwayat wish bisa ribuan baris — jangan pakai localStorage untuk ini. localStorage hanya untuk preferensi kecil.
- **Backend database:** tidak ada. Proxy stateless, tidak menyimpan atau mencatat apa pun.

---

## API WISH HISTORY — spesifikasi teknis

**Endpoint (server global/OS):**
```
https://hk4e-api-os.hoyoverse.com/event/gacha_info/api/getGachaLog
```

**PENTING:** HoYoverse pernah memindahkan endpoint ini (pernah ke `public-operation-hk4e-sg.hoyoverse.com`), dan server China memakai domain berbeda. **Jangan hardcode domain.** Ambil origin dan path dari URL yang ditempel pengguna, dan sediakan daftar fallback domain di file config yang mudah diperbarui.

**Parameter query:**
| Param | Keterangan |
|---|---|
| `authkey` | wajib, harus URL-encoded |
| `authkey_ver` | `1` |
| `sign_type` | `2` |
| `auth_appid` | `webview_gacha` |
| `lang` | `en-us` |
| `gacha_type` | kode banner, lihat tabel di bawah |
| `page` | nomor halaman |
| `size` | maksimal `20` |
| `end_id` | cursor pagination; `0` untuk halaman pertama |

**Kode banner (`gacha_type`):**
| Kode | Banner | Catatan pity |
|---|---|---|
| `100` | Novice Wish | pity terpisah |
| `200` | Standard Wish | pity terpisah |
| `301` | Character Event Wish | **berbagi pity dengan 400** |
| `400` | Character Event Wish-2 | **berbagi pity dengan 301** |
| `302` | Weapon Event Wish | pity terpisah |
| `500` | Chronicled Wish | pity terpisah |

**KRITIS:** `301` dan `400` menggunakan counter pity yang SAMA. Ini kesalahan paling umum di tool buatan sendiri — bahkan importer paimon.moe pernah rusak karena tidak mengenali `400`. Saat menghitung pity karakter, gabungkan kedua tipe menjadi satu urutan kronologis. Ikuti konvensi UIGF: normalisasi keduanya menjadi `uigf_gacha_type = "301"`.

**Bentuk response:**
```json
{
  "retcode": 0,
  "message": "OK",
  "data": {
    "page": "1", "size": "20", "total": "0", "region": "os_asia",
    "list": [
      {
        "uid": "700000000", "gacha_type": "301", "item_id": "", "count": "1",
        "time": "2021-11-24 22:18:45", "name": "Albedo", "lang": "en-us",
        "item_type": "Character", "rank_type": "5", "id": "1637787960000243756"
      }
    ]
  }
}
```

**Aturan pagination:**
- Ambil per tipe banner secara terpisah.
- Halaman pertama `end_id=0`. Halaman berikutnya, `end_id` = `id` record terakhir halaman sebelumnya.
- Berhenti ketika `list` kosong.
- **Beri jeda minimal 500ms antar request.** Tanpa jeda, HoYoverse memblokir dan retcode berubah jadi error. Ini bukan opsional.

**Penanganan error berdasarkan `retcode`:**
- `0` → sukses
- `-101` / authkey timeout → authkey kedaluwarsa. Pesan ramah: berlaku sekitar 24 jam, minta ambil ulang.
- `-110` / visit too frequent → rate limit. Backoff eksponensial lalu lanjut otomatis, jangan gagal total.
- retcode lain → pesan generik, jangan tampilkan kode mentah ke pengguna.

**Urutan record:** field `id` naik secara kronologis. Selalu urutkan berdasarkan `id`, bukan `time` — `time` memakai waktu server lokal dan bisa ambigu.

**Batas data:** sejak versi 4.5, riwayat wish in-game hanya menyimpan 1 tahun terakhir. Pull yang lebih lama tidak bisa ditarik lagi. Sebutkan ini di UI supaya pengguna lama tidak bingung kenapa datanya tidak lengkap — dan jadikan alasan kuat untuk fitur export.

---

## ALUR IMPORT — inti produk, rancang dengan serius

**Input pengguna:** satu textarea lebar untuk menempel URL wish history lengkap. Ekstrak `authkey` dari URL tersebut. Jangan minta pengguna mengekstrak authkey sendiri.

**Panduan di halaman import (fokus Windows):**

Cara kerjanya: pengguna membuka **Wish History di dalam game**, lalu menjalankan perintah PowerShell yang membaca cache browser internal game untuk menemukan URL-nya.

Peringatan penting untuk implementasi script:
- Path cache **berubah antar versi game**. Dulu `GenshinImpact_Data\webCaches\Cache\Cache_Data\data_2`, lalu berpindah ke subfolder berversi seperti `webCaches\2.13.0.1\Cache\Cache_Data\data_2`. **Jangan hardcode versinya** — pindai folder `webCaches\` dan ambil subfolder versi tertinggi.
- Dukung instalasi CN (`原神`) selain global (`Genshin Impact`).
- Lokasi instalasi game bervariasi (Epic, HoYoPlay, drive lain). Script harus mencari, bukan mengasumsikan `C:\Program Files`.
- Metode lama lewat "feedback link" **sudah tidak berfungsi**. Jangan pakai.
- **Cari dan verifikasi versi terbaru script ini sebelum menuliskannya.** Jangan tulis dari ingatan. Referensi komunitas: gist milik MadeBaruna dan repo `jogerj/genshin-wish-url`.

UI panduan harus mencakup: langkah bernomor dengan jelas, tombol copy untuk perintahnya, penjelasan singkat apa yang dilakukan perintah itu (pengguna wajar curiga pada perintah PowerShell dari internet), dan bagian troubleshooting untuk error umum.

Sediakan juga tab kecil untuk macOS/mobile yang mengarahkan ke import file UIGF, tanpa perlu detail.

**Selama import:** progress bar dengan jumlah pull yang sudah ditarik dan banner yang sedang diproses. Bisa memakan 30–60 detik untuk akun lama.

**Import ulang (incremental):** simpan `id` tertinggi per banner. Saat import lagi, berhenti begitu menemui `id` yang sudah tersimpan. Jangan pernah menarik ulang seluruh riwayat.

**Import & export file UIGF v4.x:** wajib keduanya. Membuat data portabel ke tool lain, dan jadi jalan keluar bagi pengguna non-Windows. Spesifikasi: https://uigf.org/en/standards/uigf

---

## KEAMANAN & PRIVASI — tidak bisa ditawar

- Authkey adalah kredensial. **Jangan pernah menyimpannya** — tidak di localStorage, IndexedDB, URL, maupun state yang persist. Pakai di memori selama import, lalu buang.
- Cloudflare Worker **tidak boleh** melakukan logging yang memuat authkey atau UID.
- Tampilkan penjelasan jujur dan singkat di halaman import: apa itu authkey, apa yang bisa dan tidak bisa dilakukan dengannya, dan bahwa data hanya tersimpan di perangkat pengguna.
- Jangan pernah meminta password, email, atau kredensial akun HoYoverse.

---

## ATURAN GACHA — sumber kebenaran, jangan diubah

Diverifikasi Agustus 2026 (patch 6.x). Angka ini mengikat. **Jangan mengambil dari ingatanmu sendiri** — banyak sumber lama yang salah, terutama soal Epitomized Path dan soft pity banner senjata.

**Banner Karakter (301 + 400 digabung)**
- Base rate 5★: 0.6% per pull
- Soft pity mulai pull ke-74
- Hard pity: pull ke-90
- 4★: hard pity 10 pull
- 50/50: 5★ pertama punya peluang 50% jadi karakter featured. Kalau kalah, 5★ berikutnya dijamin featured.
- Capturing Radiance: saat kalah 50/50 ada peluang tersembunyi yang mengubahnya jadi menang, sehingga rate featured efektif sekitar 55%.
- Pity dan status guaranteed carry over antar banner.

**Banner Senjata (302)**
- Base rate 5★: 0.7% per pull
- Soft pity mulai sekitar pull ke-63
- Hard pity: pull ke-80, bukan 90
- Bukan 50/50, melainkan 75/25 featured vs standar
- Epitomized Path sejak v5.0 hanya butuh 1 Fate Point, bukan 2. Worst case 160 pull.

**Banner Standar (200) dan Chronicled (500)**
- Base rate 0.6%, soft pity ~74, hard pity 90
- Tidak ada 50/50, tidak ada Capturing Radiance

**Model probabilitas**
- Karakter/Standar: 0.6% untuk pull 1–73; mulai pull 74 naik ±6 poin persen per pull; 100% di pull 90
- Senjata: 0.7% untuk pull 1–62; mulai pull 63 naik ±7 poin persen per pull; 100% di pull 80
- Peluang kumulatif dalam N pull = 1 − Π(1 − pᵢ)

**Catatan**
- Mekanisme persis Capturing Radiance tidak pernah diumumkan resmi dan sumber komunitas saling bertentangan. Jangan modelkan detailnya; pakai angka konsolidasi ~55%.
- 1 pull = 160 primogem.
- Seluruh konstanta wajib berada di satu file `src/config/gacha.ts` dengan komentar sumber. Jangan sebar angka ke komponen — aturan ini berubah tiap beberapa patch.

---

## CARA MENGHITUNG PITY DARI RIWAYAT

Untuk tiap banner: urutkan record berdasarkan `id` menaik, cari record `rank_type === "5"` paling akhir, hitung jumlah pull setelahnya. Itulah pity saat ini. Kalau tidak ada 5★ sama sekali, pity = total seluruh pull.

Status guaranteed banner karakter: lihat 5★ terakhir. Kalau bukan karakter featured banner saat itu, status = guaranteed.

**Masalah:** aplikasi ini tidak punya database banner historis, jadi tidak tahu siapa yang featured di masa lalu. **Solusi MVP:** deteksi lewat daftar karakter standard pool (Diluc, Jean, Qiqi, Mona, Keqing, Tighnari, Dehya). Kalau 5★ terakhir ada di daftar itu, berarti kalah 50/50 → guaranteed. Simpan daftar di file config, dan sediakan toggle manual supaya pengguna bisa mengoreksi kalau deteksinya meleset.

---

## FITUR

**MVP**
1. Halaman import: panduan Windows lengkap, progress bar, troubleshooting
2. Import incremental
3. Import & export file UIGF v4.x
4. Perhitungan pity otomatis per banner
5. **Dashboard utama: seluruh banner ditampilkan bersamaan** dalam grid kartu. Tiap kartu memuat nama banner, pity saat ini, sisa ke soft pity, sisa ke hard pity, status guaranteed, dan satu kalimat rekomendasi.
6. Detail per banner: peluang 5★ dalam N pull berikutnya, konversi primogem
7. Tabel riwayat 5★: nama, tanggal, pity saat didapat, menang/kalah 50/50
8. Multi-UID: deteksi otomatis dari data, switcher di header

**JANGAN dibuat**
- Login, akun, backend database
- Grafik, chart, statistik distribusi
- Ascension calculator, todo list, database karakter, achievement tracker
- Kalkulator resin
- Epitomized Path / Fate Point (fase 2)
- Fitur apa pun yang menyimpan authkey

---

## VOICE & STYLE

Bahasa Indonesia. Ramah, ringkas, sedikit playful — seperti teman yang paham gacha dan menjelaskan tanpa menggurui. Bukan wiki, bukan dashboard analitik korporat.

Benar: "Tinggal 27 pull lagi sampai soft pity. Hemat dulu ya." / "Kamu sudah di zona hoki — peluang 5★ naik drastis dari sini."
Salah: "Cumulative probability at n=74 exceeds threshold."

**Visual (desktop):**
- Dark mode sebagai default
- Konten terpusat, lebar maksimal 1440px
- Dashboard berupa grid kartu banner: 3 kolom di layar lebar, 2 kolom di menengah, 1 kolom di sempit
- Dalam tiap kartu, angka pity adalah elemen terbesar; sisanya jelas lebih kecil
- Progress bar visual menuju hard pity, dengan penanda posisi soft pity
- Aksen emas untuk 5★, ungu untuk 4★
- Header ramping berisi switcher UID, tombol import, tombol export

**Do's**
- Tulis pity selalu dalam format `47 / 90` supaya konteksnya jelas tanpa penjelasan
- Sediakan tooltip untuk setiap istilah gacha
- Beri satu kalimat rekomendasi di tiap kartu banner
- Manfaatkan hover state — ini desktop, pengguna punya kursor
- Tulis pesan error dalam bahasa manusia, bukan kode teknis
- Sediakan empty state yang mengarahkan ke halaman import

**Don'ts**
- Jangan pakai grafik atau chart
- Jangan pakai jargon tanpa penjelasan
- Jangan gunakan aset gambar resmi HoYoverse; pakai ikon generik atau bentuk CSS
- Jangan bikin sidebar navigasi — aplikasi ini hanya punya dua halaman
- Jangan tulis disclaimer panjang; satu baris di footer cukup, termasuk pernyataan tidak berafiliasi dengan HoYoverse

Aksesibilitas: kontras minimal WCAG AA, seluruh alur bisa dijalankan lewat keyboard, focus state terlihat jelas.

---

## ACCEPTANCE CRITERIA

**Logika pity** — unit test dengan fixture riwayat wish buatan:
1. Riwayat 89 pull tanpa 5★ di banner karakter → pity 89/90, soft pity aktif, peluang pull berikutnya 100%
2. 5★ di pull ke-30 lalu 15 pull lagi → pity 15
3. Riwayat campuran gacha_type 301 dan 400 → dihitung sebagai SATU counter kronologis
4. 5★ terakhir = Qiqi (standard pool) → status guaranteed ON
5. 5★ terakhir = karakter limited → status guaranteed OFF
6. Riwayat kosong → pity 0, tanpa crash
7. Banner senjata pity 63 → soft pity aktif, hard pity 80 bukan 90
8. Record dengan `id` tidak berurutan → tetap terurut benar setelah sorting

**Import**
9. URL valid → authkey terekstrak, seluruh banner tertarik, progress bar bergerak
10. URL tanpa authkey → pesan error ramah, tidak crash
11. Authkey kedaluwarsa (retcode -101) → pesan spesifik soal masa berlaku 24 jam
12. Rate limit (retcode -110) → backoff otomatis lalu lanjut, bukan gagal total
13. Import kedua kali → hanya menarik record baru, terverifikasi lewat jumlah request
14. Setelah import, authkey tidak ada di localStorage, IndexedDB, maupun URL — **wajib ada test eksplisit untuk ini**

**UIGF**
15. Export menghasilkan file valid sesuai schema UIGF v4.x
16. Hasil export bisa diimport kembali dan menghasilkan pity identik
17. File UIGF dari tool lain bisa diimport tanpa error

**Umum**
18. Dua UID berbeda tersimpan terpisah dan tidak saling menimpa
19. Reload halaman → data masih ada, tanpa perlu import ulang
20. Dashboard menampilkan seluruh banner sekaligus tanpa perlu klik apa pun

---

## DELIVERABLE

- Repo frontend siap jalan dengan `npm install && npm run dev`
- Folder `worker/` berisi Cloudflare Worker + `wrangler.toml` dan instruksi deploy
- `src/config/gacha.ts` — konstanta gacha dengan komentar sumber
- `src/config/api.ts` — endpoint dan daftar fallback domain
- `src/lib/pity.ts` — logika murni, tanpa dependensi UI atau network
- `src/lib/gachaApi.ts` — pagination, rate limiting, retry
- `src/lib/uigf.ts` — import/export UIGF
- Test suite mencakup seluruh 20 acceptance criteria
- README: cara menjalankan, cara deploy worker, cara memperbarui angka gacha saat patch berubah, cara memperbarui endpoint kalau HoYoverse memindahkannya, dan cara memperbarui script PowerShell kalau path cache berubah lagi

---

## CARA KERJA

Kerjakan dalam tiga tahap dan **berhenti untuk konfirmasi di akhir tiap tahap**:

1. `gacha.ts`, `pity.ts`, dan seluruh test logika pity. Jalankan test, tunjukkan hasilnya. Jangan sentuh network atau UI.
2. Cloudflare Worker, `gachaApi.ts`, `uigf.ts`, dan testnya. Tunjukkan hasilnya.
3. UI.

Alasannya: kalau UI dibangun lebih dulu, kesalahan perhitungan pity akan tersembunyi di balik tampilan yang terlihat masuk akal.

Kalau ada bagian brief ini yang ambigu, tanya dulu — jangan berasumsi. Untuk hal yang berubah seiring waktu (script PowerShell, path cache, domain endpoint), cari dan verifikasi dulu, jangan tulis dari ingatan.
