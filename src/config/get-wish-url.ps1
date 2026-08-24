# Mencari link Wish History dari cache browser internal Genshin Impact.
#
# Script ini hanya MEMBACA satu file cache milik game, lalu menyalin link yang
# ditemukan ke clipboard. Tidak mengirim apa pun ke internet, tidak mengunduh
# apa pun, tidak mengubah atau menghapus file game.
#
# ---------------------------------------------------------------------------
# CARA MEMPERBARUI kalau suatu saat berhenti bekerja:
#
# 1. Path cache berubah lagi?
#    Folder "webCaches" berisi subfolder berversi (mis. 2.13.0.1) yang berganti
#    tiap update game. Script ini memindai dan mengambil versi tertinggi, jadi
#    perubahan versi seharusnya tidak merusak apa pun. Kalau struktur foldernya
#    yang berubah, sesuaikan $cacheCandidates di bawah.
#
# 2. HoYoverse memindahkan endpoint API?
#    Ubah $apiGlobal / $apiChina di bawah, lalu samakan juga dengan
#    KNOWN_ENDPOINTS di src/config/api.ts.
#
# 3. Penanda link di dalam cache berubah?
#    Sesuaikan pola 'game_biz=hk4e_(global|cn)' di bagian pencarian link.
#
# Referensi komunitas yang dipantau: github.com/jogerj/genshin-wish-url
# (diverifikasi Agustus 2026, script jogerj v0.14.0).
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$apiGlobal = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'
$apiChina  = 'https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog'

# Lokasi log game. Global dan versi China (Yuanshen) punya folder berbeda.
$logPaths = @(
  "$env:USERPROFILE\AppData\LocalLow\miHoYo\Genshin Impact\output_log.txt",
  "$env:USERPROFILE\AppData\LocalLow\miHoYo\$([char]0x539f)$([char]0x795e)\output_log.txt"
) | Where-Object { Test-Path $_ }

if (-not $logPaths) {
  Write-Host 'Tidak menemukan log Genshin Impact.' -ForegroundColor Red
  Write-Host 'Buka game-nya dulu, masuk ke Wish History, baru jalankan lagi perintah ini.'
  return
}

# Lokasi instalasi dibaca dari log, bukan ditebak — jadi Epic, HoYoPlay,
# atau drive lain sama-sama ketemu.
$gameDir = $null
foreach ($logPath in $logPaths) {
  $hit = Select-String -Path $logPath -Pattern '.:/.+?(GenshinImpact_Data|YuanShen_Data)' |
         Select-Object -Last 1
  if ($hit) { $gameDir = $hit.Matches[0].Value }
}

if (-not $gameDir) {
  Write-Host 'Tidak menemukan lokasi instalasi game di dalam log.' -ForegroundColor Red
  Write-Host 'Buka Wish History di dalam game dulu, lalu jalankan lagi perintah ini.'
  return
}

$cacheRoot = Join-Path $gameDir 'webCaches'
if (-not (Test-Path $cacheRoot)) {
  Write-Host "Folder cache tidak ada di $cacheRoot." -ForegroundColor Red
  Write-Host 'Buka Wish History di dalam game dulu supaya cache-nya terbentuk.'
  return
}

# Subfolder berversi: ambil versi tertinggi, bukan yang pertama ditemukan.
# LastWriteTime jadi penentu kalau ada dua folder dengan versi sama.
$newest = Get-ChildItem -Path $cacheRoot -Directory -ErrorAction SilentlyContinue |
  Sort-Object @{ Expression = { try { [version]$_.Name } catch { [version]'0.0' } } }, LastWriteTime |
  Select-Object -Last 1

$cacheCandidates = @()
if ($newest) { $cacheCandidates += (Join-Path $newest.FullName 'Cache\Cache_Data\data_2') }
# Layout lama, sebelum folder berversi diperkenalkan.
$cacheCandidates += (Join-Path $cacheRoot 'Cache\Cache_Data\data_2')

$cacheFile = $cacheCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cacheFile) {
  Write-Host 'Tidak menemukan file cache-nya.' -ForegroundColor Red
  Write-Host 'Buka Wish History di dalam game, tunggu sampai daftarnya tampil, lalu coba lagi.'
  return
}

if ((Get-Item $cacheFile).LastWriteTime -lt (Get-Date).AddDays(-1)) {
  Write-Host 'Cache-nya sudah lebih dari sehari.' -ForegroundColor Yellow
  Write-Host 'Kalau link yang dihasilkan ternyata kedaluwarsa, buka lagi Wish History di dalam game.'
}

# File cache dikunci selama game berjalan, jadi disalin dulu ke folder temp.
$tempCopy = Join-Path $env:TEMP 'gpt_data_2'
Copy-Item $cacheFile -Destination $tempCopy -Force
$content = Get-Content -Raw -Encoding UTF8 $tempCopy
Remove-Item $tempCopy -Force

# Entri cache dipisah penanda '1/0/'. Yang terakhir adalah yang paling baru.
$lastEntry = ($content -split '1/0/')[-1]
if ($lastEntry -notmatch 'https.+?game_biz=hk4e_(global|cn)') {
  Write-Host 'Cache-nya ketemu, tapi link wish history tidak ada di dalamnya.' -ForegroundColor Red
  Write-Host 'Buka lagi Wish History di dalam game, tunggu daftarnya benar-benar tampil, lalu ulangi.'
  return
}

$rawUrl = $Matches[0]
$apiBase = if ($rawUrl -match 'hk4e_cn') { $apiChina } else { $apiGlobal }
$wishUrl = $apiBase + $rawUrl.Substring($rawUrl.IndexOf('?'))

Set-Clipboard -Value $wishUrl
Write-Host ''
Write-Host 'Berhasil! Link sudah tersalin ke clipboard.' -ForegroundColor Green
Write-Host 'Tinggal tempel di halaman import (Ctrl+V).'
