/**
 * Seluruh teks yang dilihat pengguna, dalam dua bahasa.
 *
 * Aturannya sederhana: tidak ada string tampilan yang ditulis di dalam komponen.
 * Kalau ada kalimat baru, tempatnya di sini — supaya kedua bahasa tidak pernah
 * bisa berbeda isi tanpa ketahuan (ada test yang membandingkan struktur keduanya).
 *
 * Nada bicara sama di kedua bahasa: teman yang paham gacha, bukan wiki.
 * Bahasa Inggris adalah default; Indonesia tersedia lewat pengalih di sidebar.
 */

export type Locale = "id" | "en";

/** Urutannya menentukan urutan pilihan di pengalih bahasa. */
export const LOCALES: Locale[] = ["en", "id"];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABEL: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

export interface Copy {
  localeLabel: string;
  appName: string;

  nav: {
    wishCounter: string;
    account: string;
    noAccount: string;
    selectAccount: string;
    language: string;
  };

  header: {
    title: string;
    autoImport: string;
    importFile: string;
    nothingImported: string;
    /** "Diperbarui 2 jam lalu · 1.416 pull tercatat" */
    meta: (when: string, pulls: string) => string;
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    yesterday: string;
    daysAgo: (n: number) => string;
    loading: string;
  };

  banner: {
    names: Record<string, string>;
    tags: Record<string, string>;
    lifetimePulls: string;
    pity5: string;
    pity4: string;
    guaranteedAt: (n: number) => string;
    guaranteedAt4: string;
    primo: string;
    seeOdds: string;
    hideDetails: string;
    morePulls: (n: number) => string;
    untilGuaranteed: (n: number) => string;
    correct: string;
    correctHint: string;
  };

  /** Kalimat rekomendasi. Urutan cabangnya identik di kedua bahasa. */
  advice: {
    noData: string;
    nextIsGuaranteed: string;
    almostGuaranteed: (n: number) => string;
    luckyZone: string;
    luckyZoneGuaranteed: string;
    farFromSoftPity: (n: number) => string;
    nearSoftPity: (n: number) => string;
  };

  featured: {
    none: string;
    guaranteed: string;
    chance: (pct: string) => string;
  };

  chart: {
    title: string;
    lastMonths: (n: number) => string;
    series: { character: string; weapon: string; standard: string };
    caption: (total: string, month: string, n: string) => string;
    barTitle: (month: string, n: string) => string;
    empty: string;
  };

  tables: {
    characterEvent: string;
    weaponStandard: string;
    total: string;
    percent: string;
    avgPity: string;
    fiveStar: string;
    fourStar: string;
    won5050: string;
    fourStarCharacter: string;
    fourStarWeapon: string;
    fiveStarWeapon: string;
    gotRateUp: string;
    fiveStarStandard: string;
    fourStarStandard: string;
    empty: string;
  };

  firstRun: {
    pill: string;
    heading: string;
    body: string;
    primary: string;
    secondary: string;
    notes: string[];
  };

  import: {
    title: string;
    back: string;
    intro: string;
    tabWindows: string;
    tabFile: string;
    steps: Array<{ title: string; body: string }>;
    scriptCaption: string;
    copy: string;
    copied: string;
    troubleTitle: string;
    troubles: Array<{ q: string; a: string }>;
    whatItDoesTitle: string;
    whatItDoesIntro: string;
    whatItDoes: string[];
    whatItDoesNot: string;
    notWindowsTitle: string;
    notWindowsBody: string;
    chooseFile: string;
    pasteTitle: string;
    pasteHint: string;
    pastePlaceholder: string;
    pasteLabel: string;
    pull: string;
    pulling: string;
    cancel: string;
    progress: (banner: string, pulls: string) => string;
    throttled: string;
    keepOpen: string;
    doneWithNew: (n: string) => string;
    doneNothingNew: string;
    doneNote: string;
    seeCounter: string;
    tryAgain: string;
  };

  privacy: {
    title: string;
    paragraphs: string[];
  };

  footer: {
    retention: string;
    notAffiliated: string;
    uigf: string;
  };

  glossary: Record<string, string>;
}

const ID: Copy = {
  localeLabel: LOCALE_LABEL.id,
  appName: "Pity Tracker By Vonfring",

  nav: {
    wishCounter: "Wish Counter",
    account: "Akun",
    noAccount: "Belum ada akun",
    selectAccount: "Pilih akun",
    language: "Bahasa",
  },

  header: {
    title: "Wish Counter",
    autoImport: "Import Otomatis",
    importFile: "Import File UIGF",
    nothingImported: "Belum ada data",
    meta: (when, pulls) => `Diperbarui ${when} · ${pulls} pull tercatat`,
    justNow: "baru saja",
    minutesAgo: (n) => `${n} menit lalu`,
    hoursAgo: (n) => `${n} jam lalu`,
    yesterday: "kemarin",
    daysAgo: (n) => `${n} hari lalu`,
    loading: "Memuat data…",
  },

  banner: {
    names: {
      "301": "Banner Karakter",
      "302": "Banner Senjata",
      "200": "Banner Standar",
      "500": "Chronicled Wish",
      "100": "Novice Wish",
    },
    tags: {
      "301": "50/50",
      "302": "75/25",
      "200": "Tanpa 50/50",
      "500": "Pilih sendiri",
      "100": "Pemula",
    },
    lifetimePulls: "Total Pull",
    pity5: "Pity 5★",
    pity4: "Pity 4★",
    guaranteedAt: (n) => `Dijamin di ${n}`,
    guaranteedAt4: "Dijamin di 10",
    primo: "primo",
    seeOdds: "Lihat peluang & biaya",
    hideDetails: "Tutup detail",
    morePulls: (n) => `${n} pull lagi`,
    untilGuaranteed: (n) => `Sampai dijamin (${n}x)`,
    correct: "Koreksi",
    correctHint: "Deteksi otomatis bisa meleset. Klik untuk mengoreksi.",
  },

  advice: {
    noData: "Belum ada data di banner ini.",
    nextIsGuaranteed: "Pull berikutnya dijamin 5★. Gas.",
    almostGuaranteed: (n) => `Tinggal ${n} pull lagi sampai dijamin. Habiskan saja.`,
    luckyZone: "Kamu sudah di zona hoki — peluangnya naik terus dari sini.",
    luckyZoneGuaranteed:
      "Kamu sudah di zona hoki, dan kali ini dijamin dapat yang lagi rate-up.",
    farFromSoftPity: (n) => `Masih ${n} pull lagi ke zona hoki. Santai saja di banner ini.`,
    nearSoftPity: (n) => `Tinggal ${n} pull lagi sampai soft pity. Hemat dulu ya.`,
  },

  featured: {
    none: "Banner ini tidak punya undian featured — semua 5★ dari pool standar.",
    guaranteed: "5★ berikutnya dijamin yang lagi rate-up, karena undian terakhirmu kalah.",
    chance: (pct) => `Kalau 5★-nya keluar, peluangnya ${pct} jadi yang lagi rate-up.`,
  },

  chart: {
    title: "Pull per Bulan",
    lastMonths: (n) => `${n} bulan terakhir`,
    series: { character: "Karakter", weapon: "Senjata", standard: "Standar" },
    caption: (total, month, n) =>
      `Total ${total} pull di sini, bulan paling ramai ${month} dengan ${n}.`,
    barTitle: (month, n) => `${month}: ${n} pull`,
    empty: "Belum ada pull yang tercatat di rentang ini.",
  },

  tables: {
    characterEvent: "Banner Karakter",
    weaponStandard: "Senjata & Standar",
    total: "Total",
    percent: "Persen",
    avgPity: "Rata-rata Pity",
    fiveStar: "5★",
    fourStar: "4★",
    won5050: "menang 50/50",
    fourStarCharacter: "karakter",
    fourStarWeapon: "senjata",
    fiveStarWeapon: "5★ senjata",
    gotRateUp: "dapat yang rate-up",
    fiveStarStandard: "5★ standar",
    fourStarStandard: "4★ standar",
    empty: "Belum ada apa-apa di sini.",
  },

  firstRun: {
    pill: "Belum ada yang diimport",
    heading: "Ayo masukkan riwayat wish-mu",
    body:
      "Sekitar semenit, dan cuma perlu sekali. Di Windows, satu perintah mengambilkan link-nya untukmu; di luar itu, bawa file UIGF. Semua di bawah akan terisi sendiri setelahnya.",
    primary: "Import riwayat wish",
    secondary: "Aku punya file UIGF",
    notes: [
      "Tanpa akun, tanpa login — datanya cuma ada di browser ini.",
      "Authkey-mu dipakai sekali lalu dibuang, tidak disimpan di mana pun.",
      "Beberapa UID disimpan terpisah, jadi akun keluarga tidak tercampur.",
    ],
  },

  import: {
    title: "Import Riwayat Wish",
    back: "Kembali ke counter",
    intro:
      "Genshin tidak punya tombol export, jadi link wish-nya dibaca dari cache game di PC-mu sendiri. Kedengarannya ribet, padahal cuma salin-tempel.",
    tabWindows: "Windows",
    tabFile: "macOS / HP",
    steps: [
      {
        title: "Buka Wish History di dalam game",
        body: "Di Genshin, masuk ke Wish → History, tunggu sampai daftarnya benar-benar tampil. Langkah inilah yang menulis link-nya ke cache — dilewati, perintah di bawah tidak akan menemukan apa pun.",
      },
      {
        title: "Buka PowerShell",
        body: "Tekan Win, ketik PowerShell, buka. Tidak perlu Run as Administrator.",
      },
      {
        title: "Tempel perintahnya, lalu Enter",
        body: "Salin dari sini, tempel di jendela PowerShell, Enter. Kalau berhasil, link-nya langsung mendarat di clipboard.",
      },
      {
        title: "Tempel link-nya di sebelah kanan",
        body: "Ctrl+V ke kolomnya, lalu tekan Tarik data. Untuk akun lama bisa sampai semenit.",
      },
    ],
    scriptCaption: "Perintahnya panjang — dan itu disengaja, supaya bisa kamu baca sebelum dijalankan.",
    copy: "Salin",
    copied: "Tersalin",
    troubleTitle: "Kalau ada yang tidak beres",
    troubles: [
      {
        q: "Tulisan merah: tidak menemukan log Genshin",
        a: "Game-nya belum pernah dibuka di akun Windows ini. Buka game-nya, masuk Wish History sekali, lalu ulangi.",
      },
      {
        q: "File cache ketemu, tapi link-nya tidak ada",
        a: "Hampir selalu karena Wish History belum benar-benar dibuka. Buka di dalam game, tunggu daftarnya penuh, jangan langsung ditutup, baru jalankan lagi perintahnya.",
      },
      {
        q: "PowerShell menolak menjalankan script",
        a: "Perintah ini ditempel langsung ke jendela PowerShell, jadi execution policy tidak berlaku. Kalau tetap ditolak, pastikan yang kamu buka Windows PowerShell, bukan Command Prompt.",
      },
      {
        q: "Link-nya kedaluwarsa terus",
        a: "Link wish history cuma berlaku sekitar 24 jam. Buka lagi Wish History di dalam game supaya cache-nya diperbarui, lalu jalankan lagi perintahnya.",
      },
      {
        q: "Aku pakai klien China (原神)",
        a: "Didukung. Script-nya memeriksa kedua lokasi instalasi, jadi tidak perlu diubah.",
      },
      {
        q: "Pull lamaku hilang",
        a: "Sejak versi 4.5, game cuma menyimpan riwayat satu tahun. Yang lebih lama tidak bisa ditarik oleh tool mana pun. Kalau punya file export lama, masukkan lewat tab macOS / HP.",
      },
    ],
    whatItDoesTitle: "Perintah itu sebenarnya ngapain?",
    whatItDoesIntro:
      "Wajar kalau ragu menjalankan perintah PowerShell dari internet. Ini isinya, singkatnya:",
    whatItDoes: [
      "Membaca output_log.txt milik game untuk tahu di mana Genshin terpasang.",
      "Menyalin satu file cache browser internal game ke folder sementara, lalu membacanya.",
      "Mencari link Wish History di dalamnya, lalu menyalinnya ke clipboard.",
    ],
    whatItDoesNot:
      "Yang tidak dilakukannya: tidak mengunduh apa pun, tidak mengirim apa pun ke internet, tidak mengubah atau menghapus file game, dan tidak menyentuh akun HoYoverse-mu.",
    notWindowsTitle: "Bukan di Windows?",
    notWindowsBody:
      "Cara cache itu cuma jalan di PC. Di macOS atau HP, lewat file saja: export UIGF v4 dari tool lain, lalu masukkan di sini. File hasil export aplikasi ini juga bisa dimasukkan kembali.",
    chooseFile: "Pilih file UIGF…",
    pasteTitle: "Tempel link-nya di sini",
    pasteHint: "Link panjang yang diawali https://. Tempel seluruhnya, jangan dipotong.",
    pastePlaceholder:
      "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog?authkey=...",
    pasteLabel: "Link wish history",
    pull: "Tarik data",
    pulling: "Menarik data…",
    cancel: "Batal",
    progress: (banner, pulls) => `Menarik ${banner}… ${pulls} pull terkumpul`,
    throttled: "Sedang dibatasi HoYoverse — menunggu sebentar, lalu lanjut sendiri…",
    keepOpen: "Untuk akun lama bisa sampai semenit. Jangan tutup tab-nya ya.",
    doneWithNew: (n) => `Berhasil — ${n} pull baru masuk.`,
    doneNothingNew: "Sudah paling baru — tidak ada pull baru sejak terakhir kali.",
    doneNote:
      "Yang lebih lama dari setahun sudah tidak ada di server HoYoverse, jadi tidak akan muncul.",
    seeCounter: "Lihat counter",
    tryAgain: "Coba lagi",
  },

  privacy: {
    title: "Soal authkey itu",
    paragraphs: [
      "Link itu membawa authkey — kunci sementara yang cuma bisa membaca riwayat wish, dan cuma berlaku sekitar 24 jam. Yang tidak bisa dilakukannya: masuk ke akunmu, melihat karakter atau primogem-mu, atau mengubah apa pun.",
      "Ia dipakai sekali selama proses tarik data, lalu dibuang. Tidak pernah disimpan — tidak di browser, tidak di server. Riwayat wish hasilnya tetap di perangkat ini.",
      "Kami tidak pernah meminta password, email, atau data akun HoYoverse-mu.",
    ],
  },

  footer: {
    retention:
      "Game cuma menyimpan riwayat wish satu tahun terakhir, jadi sesekali export datamu.",
    notAffiliated: "Tidak berafiliasi dengan HoYoverse.",
    uigf: "Format UIGF",
  },

  glossary: {
    pity: "Hitungan pull sejak terakhir kali kamu dapat 5★. Makin tinggi, makin dekat ke jaminan.",
    "soft pity":
      "Mulai pull tertentu, peluang dapat 5★ naik tajam. Kebanyakan 5★ keluar di zona ini.",
    "hard pity": "Batas paling akhir. Sampai di sini, 5★ pasti keluar.",
    "50/50":
      "Saat dapat 5★ di banner karakter, peluangnya 50% jadi karakter yang lagi rate-up. Kalau kalah, yang keluar karakter standar.",
    "75/25":
      "Versi banner senjata: 75% peluang dapat senjata yang lagi rate-up, 25% dapat senjata standar.",
    guaranteed:
      "Karena 5★ terakhirmu kalah undian, 5★ berikutnya dijamin yang lagi rate-up.",
    "capturing radiance":
      "Mekanik tersembunyi yang kadang mengubah kekalahan 50/50 jadi kemenangan, sehingga peluang aslinya sekitar 55%.",
    primogem: "Mata uang buat wish. 160 primogem = 1 pull.",
    uid: "Nomor akun Genshin-mu. Tiap akun disimpan terpisah di aplikasi ini.",
  },
};

const EN: Copy = {
  localeLabel: LOCALE_LABEL.en,
  appName: "Pity Tracker By Vonfring",

  nav: {
    wishCounter: "Wish Counter",
    account: "Account",
    noAccount: "No account yet",
    selectAccount: "Select UID",
    language: "Language",
  },

  header: {
    title: "Wish Counter",
    autoImport: "Auto Import",
    importFile: "Import UIGF File",
    // Sengaja berbeda dari firstRun.pill: yang ini baris meta di header,
    // dan keduanya bisa tampil di layar yang sama.
    nothingImported: "No data yet",
    meta: (when, pulls) => `Updated ${when} · ${pulls} pulls recorded`,
    justNow: "just now",
    minutesAgo: (n) => `${n} minutes ago`,
    hoursAgo: (n) => `${n} hours ago`,
    yesterday: "yesterday",
    daysAgo: (n) => `${n} days ago`,
    loading: "Loading your data…",
  },

  banner: {
    names: {
      "301": "Character Event",
      "302": "Weapon Event",
      "200": "Standard",
      "500": "Chronicled Wish",
      "100": "Novice Wish",
    },
    tags: {
      "301": "50/50",
      "302": "75/25",
      "200": "No 50/50",
      "500": "Pick your own",
      "100": "Beginner",
    },
    lifetimePulls: "Lifetime Pulls",
    pity5: "5★ Pity",
    pity4: "4★ Pity",
    guaranteedAt: (n) => `Guaranteed at ${n}`,
    guaranteedAt4: "Guaranteed at 10",
    primo: "primo",
    seeOdds: "See odds & cost",
    hideDetails: "Hide details",
    morePulls: (n) => `${n} more pulls`,
    untilGuaranteed: (n) => `Until guaranteed (${n}x)`,
    correct: "Correct",
    correctHint: "Auto-detection can be wrong. Click to fix it.",
  },

  advice: {
    noData: "No data on this banner yet.",
    nextIsGuaranteed: "Your next pull is a guaranteed 5★. Go.",
    almostGuaranteed: (n) => `Only ${n} pulls to guaranteed. Might as well finish it.`,
    luckyZone: "You're in the lucky zone — the odds climb with every pull from here.",
    luckyZoneGuaranteed:
      "You're in the lucky zone, and this one is a guaranteed rate-up.",
    farFromSoftPity: (n) => `Still ${n} pulls to the lucky zone. Take it easy.`,
    nearSoftPity: (n) => `Just ${n} pulls to soft pity. Save up a bit more.`,
  },

  featured: {
    none: "No featured roll on this banner — every 5★ comes from the standard pool.",
    guaranteed: "Your next 5★ is a guaranteed rate-up, because you lost the last roll.",
    chance: (pct) => `When a 5★ drops, there's a ${pct} chance it's the rate-up one.`,
  },

  chart: {
    title: "Pulls per Month",
    lastMonths: (n) => `Last ${n} months`,
    series: { character: "Character", weapon: "Weapon", standard: "Standard" },
    caption: (total, month, n) =>
      `${total} pulls here in total, busiest month was ${month} with ${n}.`,
    barTitle: (month, n) => `${month}: ${n} pulls`,
    empty: "No pulls recorded in this range yet.",
  },

  tables: {
    characterEvent: "Character Event",
    weaponStandard: "Weapon & Standard",
    total: "Total",
    percent: "Percent",
    avgPity: "Avg. Pity",
    fiveStar: "5★",
    fourStar: "4★",
    won5050: "won 50/50",
    fourStarCharacter: "character",
    fourStarWeapon: "weapon",
    fiveStarWeapon: "5★ weapon",
    gotRateUp: "got the rate-up",
    fiveStarStandard: "5★ standard",
    fourStarStandard: "4★ standard",
    empty: "Nothing here yet.",
  },

  firstRun: {
    pill: "Nothing imported yet",
    heading: "Let's get your wish history in",
    body:
      "Takes about a minute, and you only do it once. On Windows one command grabs the link for you; anywhere else, bring a UIGF file. Everything below fills in by itself after that.",
    primary: "Import wish history",
    secondary: "I have a UIGF file",
    notes: [
      "No account, no login — the data lives in this browser only.",
      "Your authkey is used once and never stored anywhere.",
      "Multiple UIDs are kept separately, so family accounts don't mix.",
    ],
  },

  import: {
    title: "Import Wish History",
    back: "Back to counter",
    intro:
      "Genshin has no export button, so the wish link gets read from the game's own cache on your PC. Sounds messy, but it's really just copy and paste.",
    tabWindows: "Windows",
    tabFile: "macOS / Mobile",
    steps: [
      {
        title: "Open Wish History inside the game",
        body: "In Genshin, go to Wish → History and wait until the list is fully loaded. That's what writes the link into the cache — skip it and the command finds nothing.",
      },
      {
        title: "Open PowerShell",
        body: "Press Win, type PowerShell, open it. No need to run as administrator.",
      },
      {
        title: "Paste the command, hit Enter",
        body: "Copy it from here, paste it into the PowerShell window, Enter. If it works, the link lands straight on your clipboard.",
      },
      {
        title: "Paste the link on the right",
        body: "Ctrl+V into the box, then hit Pull data. Older accounts can take about a minute.",
      },
    ],
    scriptCaption: "It's a long command on purpose — so you can read it before you run it.",
    copy: "Copy",
    copied: "Copied",
    troubleTitle: "If something goes wrong",
    troubles: [
      {
        q: "Red text: can't find the Genshin log",
        a: "The game hasn't been opened on this Windows account yet. Launch it, open Wish History once, then try again.",
      },
      {
        q: "Cache file found, but no link inside",
        a: "Almost always because Wish History wasn't really opened. Open it in-game, wait for the full list, don't close it right away, then run the command again.",
      },
      {
        q: "PowerShell refuses to run the script",
        a: "You're pasting straight into the PowerShell window, so execution policy doesn't apply. If it still refuses, make sure you opened Windows PowerShell and not Command Prompt.",
      },
      {
        q: "The link keeps expiring",
        a: "Wish history links last about 24 hours. Reopen Wish History in-game so the cache refreshes, then run the command again.",
      },
      {
        q: "I'm on the China client (原神)",
        a: "Supported. The script checks both install locations, so nothing needs changing.",
      },
      {
        q: "My old pulls are missing",
        a: "Since version 4.5 the game only keeps one year of history. Anything older can't be pulled by any tool. If you have an older export file, bring it in through the macOS / Mobile tab.",
      },
    ],
    whatItDoesTitle: "What does that command actually do?",
    whatItDoesIntro:
      "It's fair to hesitate before running a PowerShell command off the internet. Here's what's inside, briefly:",
    whatItDoes: [
      "Reads the game's output_log.txt to find where Genshin is installed.",
      "Copies one cache file from the game's internal browser to a temp folder, then reads it.",
      "Finds the Wish History link inside and copies it to your clipboard.",
    ],
    whatItDoesNot:
      "What it does not do: download anything, send anything to the internet, change or delete any game file, or touch your HoYoverse account.",
    notWindowsTitle: "Not on Windows?",
    notWindowsBody:
      "The cache trick only works on a PC. On macOS or mobile, go through a file instead: export UIGF v4 from another tool and drop it here. Exports from this app import back in too.",
    chooseFile: "Choose UIGF file…",
    pasteTitle: "Paste your link here",
    pasteHint: "The long one starting with https://. Paste all of it, don't trim it.",
    pastePlaceholder:
      "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog?authkey=...",
    pasteLabel: "Wish history link",
    pull: "Pull data",
    pulling: "Pulling data…",
    cancel: "Cancel",
    progress: (banner, pulls) => `Pulling ${banner}… ${pulls} pulls collected`,
    throttled: "Rate-limited by HoYoverse — waiting a moment, it continues on its own…",
    keepOpen: "Older accounts can take up to a minute. Keep this tab open.",
    doneWithNew: (n) => `Done — ${n} new pulls came in.`,
    doneNothingNew: "Already up to date — nothing new since last time.",
    doneNote:
      "Anything older than a year isn't on HoYoverse's servers anymore, so it won't show up.",
    seeCounter: "See the counter",
    tryAgain: "Try again",
  },

  privacy: {
    title: "About that authkey",
    paragraphs: [
      "The link carries an authkey — a temporary key that can only read wish history, and only for about 24 hours. What it cannot do: sign into your account, see your characters or primogems, or change anything.",
      "It gets used once while pulling your data, then thrown away. It is never stored — not in your browser, not on a server. The wish history itself stays on this device.",
      "We never ask for your password, email, or HoYoverse account details.",
    ],
  },

  footer: {
    retention:
      "The game only keeps the last year of wish history, so export your data once in a while.",
    notAffiliated: "Not affiliated with HoYoverse.",
    uigf: "Format UIGF",
  },

  glossary: {
    pity: "How many pulls since your last 5★. The higher it climbs, the closer the guarantee.",
    "soft pity":
      "Past a certain pull, the 5★ rate jumps sharply. Most 5★ drops happen in this zone.",
    "hard pity": "The hard ceiling. Reach it and a 5★ is certain.",
    "50/50":
      "When a 5★ drops on the character banner, it's a 50% chance to be the rate-up one. Lose it and you get a standard-pool character instead.",
    "75/25":
      "The weapon banner version: 75% chance to get one of the rate-up weapons, 25% a standard one.",
    guaranteed:
      "Because your last 5★ lost the roll, your next one is guaranteed to be the rate-up.",
    "capturing radiance":
      "A hidden mechanic that sometimes turns a lost 50/50 into a win, making the real rate about 55%.",
    primogem: "The currency for wishes. 160 primogems = 1 pull.",
    uid: "Your Genshin account number. Each account is stored separately here.",
  },
};

export const COPY: Record<Locale, Copy> = { id: ID, en: EN };

export function getCopy(locale: Locale): Copy {
  return COPY[locale] ?? COPY[DEFAULT_LOCALE];
}

/** Pemisah ribuan mengikuti bahasa: 1.416 di ID, 1,416 di EN. */
export function numberLocale(locale: Locale): string {
  return locale === "id" ? "id-ID" : "en-US";
}
