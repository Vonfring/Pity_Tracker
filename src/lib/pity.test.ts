/**
 * Acceptance criteria 1-8 (logika pity) plus test pendukung.
 * Nomor kriteria dari brief ditulis di judul test supaya mudah ditelusuri.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { BANNERS, PRIMOGEMS_PER_PULL } from "../config/gacha";
import {
  chanceWithin,
  compareWishId,
  computeAllPity,
  computeBannerPity,
  dedupeAndSort,
  extractUids,
  featuredChance,
  fiveStarRateAt,
  groupByBanner,
  isStandardPoolFiveStar,
  latestIdByRawType,
  normalizeGachaType,
  primogemsToPulls,
  pullsToPrimogems,
  sortByIdAsc,
} from "./pity";
import { filler, fiveStar, fourStar, history, makePull, resetIdCursor } from "../test/fixtures";

const CHARACTER = BANNERS["301"];
const WEAPON = BANNERS["302"];

beforeEach(() => {
  resetIdCursor();
});

// ---------------------------------------------------------------------------
// Kriteria 1 - 89 pull tanpa 5 bintang di banner karakter
// ---------------------------------------------------------------------------

describe("kriteria 1: 89 pull tanpa 5 bintang di banner karakter", () => {
  it("pity 89/90, soft pity aktif, peluang pull berikutnya 100%", () => {
    const state = computeBannerPity(filler(89, "301"), "301");

    expect(state.pity).toBe(89);
    expect(state.hardPity).toBe(90);
    expect(state.totalPulls).toBe(89);
    expect(state.isSoftPity).toBe(true);
    expect(state.pullsToSoftPity).toBe(0);
    expect(state.pullsToHardPity).toBe(1);
    expect(state.nextPullChance).toBe(1);
    expect(state.last5Star).toBeNull();
    expect(chanceWithin(state.pity, 1, CHARACTER)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 2 - 5 bintang di pull ke-30 lalu 15 pull lagi
// ---------------------------------------------------------------------------

describe("kriteria 2: 5 bintang di pull ke-30 lalu 15 pull lagi", () => {
  it("pity kembali ke 15 dan pity 5 bintang itu tercatat 30", () => {
    const records = history(
      filler(29, "301"),
      fiveStar("301", "Furina"),
      filler(15, "301"),
    );

    const state = computeBannerPity(records, "301");

    expect(state.pity).toBe(15);
    expect(state.totalPulls).toBe(45);
    expect(state.fiveStars).toHaveLength(1);
    expect(state.fiveStars[0]?.pity).toBe(30);
    expect(state.isSoftPity).toBe(false);
    expect(state.pullsToSoftPity).toBe(58);
    expect(state.pullsToHardPity).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 3 - 301 dan 400 adalah SATU counter
// ---------------------------------------------------------------------------

describe("kriteria 3: gacha_type 301 dan 400 digabung jadi satu counter", () => {
  it("5 bintang di banner 400 mereset pity yang dikumpulkan di 301", () => {
    const records = history(
      filler(10, "301"),
      fiveStar("400", "Furina"),
      filler(5, "301"),
    );

    const state = computeBannerPity(records, "301");

    expect(state.totalPulls).toBe(16);
    expect(state.pity).toBe(5);
    expect(state.fiveStars[0]?.pity).toBe(11);
  });

  it("pity terus berjalan lintas 301 dan 400 secara kronologis", () => {
    const records = history(
      filler(40, "301"),
      filler(30, "400"),
      filler(3, "301"),
    );

    const state = computeBannerPity(records, "301");

    expect(state.pity).toBe(73);
    expect(state.isSoftPity).toBe(true);
    expect(state.pullsToSoftPity).toBe(0);
  });

  it("normalizeGachaType dan groupByBanner melebur 400 ke 301", () => {
    expect(normalizeGachaType("400")).toBe("301");
    expect(normalizeGachaType("301")).toBe("301");
    expect(normalizeGachaType("302")).toBe("302");

    const groups = groupByBanner(history(filler(2, "301"), filler(3, "400"), filler(1, "302")));

    expect(groups.get("301")).toHaveLength(5);
    expect(groups.get("302")).toHaveLength(1);
    expect(groups.has("400" as never)).toBe(false);
  });

  it("banner lain tidak ikut terhitung ke pity karakter", () => {
    const records = history(filler(20, "302"), filler(10, "200"), filler(4, "301"));

    expect(computeBannerPity(records, "301").pity).toBe(4);
    expect(computeBannerPity(records, "302").pity).toBe(20);
    expect(computeBannerPity(records, "200").pity).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 4 & 5 - deteksi status guaranteed
// ---------------------------------------------------------------------------

describe("kriteria 4: 5 bintang terakhir dari standard pool", () => {
  it("Qiqi sebagai 5 bintang terakhir mengaktifkan status guaranteed", () => {
    const records = history(filler(20, "301"), fiveStar("301", "Qiqi"), filler(12, "301"));

    const state = computeBannerPity(records, "301");

    expect(state.guaranteed).toBe(true);
    expect(state.guaranteedIsManual).toBe(false);
    expect(state.last5Star?.name).toBe("Qiqi");
    expect(state.last5Star?.wonFeatured).toBe(false);
    expect(featuredChance(CHARACTER, state.guaranteed)).toBe(1);
  });

  it("seluruh nama standard pool terdeteksi, case-insensitive", () => {
    for (const name of ["Diluc", "Jean", "Qiqi", "Mona", "Keqing", "Tighnari", "Dehya"]) {
      expect(isStandardPoolFiveStar(name)).toBe(true);
      expect(isStandardPoolFiveStar(name.toLowerCase())).toBe(true);
      expect(isStandardPoolFiveStar(` ${name.toUpperCase()} `)).toBe(true);
    }
    for (const weapon of ["Amos' Bow", "Wolf's Gravestone", "Skyward Blade", "Aquila Favonia"]) {
      expect(isStandardPoolFiveStar(weapon)).toBe(true);
    }
    expect(isStandardPoolFiveStar("Furina")).toBe(false);
    expect(isStandardPoolFiveStar("Splendor of Tranquil Waters")).toBe(false);
  });
});

describe("kriteria 5: 5 bintang terakhir karakter limited", () => {
  it("Furina sebagai 5 bintang terakhir mematikan status guaranteed", () => {
    const records = history(filler(20, "301"), fiveStar("301", "Furina"), filler(12, "301"));

    const state = computeBannerPity(records, "301");

    expect(state.guaranteed).toBe(false);
    expect(state.last5Star?.wonFeatured).toBe(true);
    expect(featuredChance(CHARACTER, state.guaranteed)).toBeCloseTo(0.55, 10);
  });

  it("5 bintang yang ditarik saat guaranteed aktif tidak dicap menang undian", () => {
    const records = history(
      filler(10, "301"),
      fiveStar("301", "Mona"), // kalah 50/50 -> guaranteed aktif
      filler(10, "301"),
      fiveStar("400", "Neuvillette"), // dijamin, bukan hasil 50/50
      filler(3, "301"),
    );

    const state = computeBannerPity(records, "301");

    expect(state.fiveStars.map((p) => p.name)).toEqual(["Mona", "Neuvillette"]);
    expect(state.fiveStars[0]?.wonFeatured).toBe(false);
    expect(state.fiveStars[0]?.wasGuaranteed).toBe(false);
    expect(state.fiveStars[1]?.wonFeatured).toBeNull();
    expect(state.fiveStars[1]?.wasGuaranteed).toBe(true);
    expect(state.guaranteed).toBe(false);
    expect(state.pity).toBe(3);
  });

  it("toggle manual menimpa hasil deteksi otomatis", () => {
    const records = history(filler(5, "301"), fiveStar("301", "Furina"), filler(2, "301"));

    const auto = computeBannerPity(records, "301");
    const manual = computeBannerPity(records, "301", { guaranteedOverride: true });

    expect(auto.guaranteed).toBe(false);
    expect(manual.guaranteed).toBe(true);
    expect(manual.guaranteedIsManual).toBe(true);
  });

  it("banner tanpa mekanik featured tidak pernah berstatus guaranteed", () => {
    const records = history(filler(5, "200"), fiveStar("200", "Qiqi"), filler(2, "200"));

    const state = computeBannerPity(records, "200", { guaranteedOverride: true });

    expect(state.hasFeaturedMechanic).toBe(false);
    expect(state.guaranteed).toBe(false);
    expect(state.last5Star?.wonFeatured).toBeNull();
    expect(featuredChance(BANNERS["200"], false)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 6 - riwayat kosong
// ---------------------------------------------------------------------------

describe("kriteria 6: riwayat kosong", () => {
  it("pity 0 tanpa crash", () => {
    const state = computeBannerPity([], "301");

    expect(state.pity).toBe(0);
    expect(state.totalPulls).toBe(0);
    expect(state.last5Star).toBeNull();
    expect(state.fiveStars).toEqual([]);
    expect(state.guaranteed).toBe(false);
    expect(state.isSoftPity).toBe(false);
    expect(state.pullsToSoftPity).toBe(73);
    expect(state.pullsToHardPity).toBe(90);
    expect(state.nextPullChance).toBeCloseTo(0.006, 10);
    expect(state.lastPullTime).toBeNull();
  });

  it("computeAllPity tetap mengembalikan seluruh banner", () => {
    const all = computeAllPity([]);

    for (const id of ["301", "302", "200", "500", "100"] as const) {
      expect(all[id]).toBeDefined();
      expect(all[id].pity).toBe(0);
    }
    expect(all["302"].hardPity).toBe(80);
  });

  it("banner yang tidak punya data tetap muncul walau banner lain terisi", () => {
    const all = computeAllPity(filler(30, "301"));

    expect(all["301"].pity).toBe(30);
    expect(all["302"].pity).toBe(0);
    expect(all["500"].totalPulls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 7 - banner senjata
// ---------------------------------------------------------------------------

describe("kriteria 7: banner senjata pity 63", () => {
  it("soft pity aktif dan hard pity 80, bukan 90", () => {
    const state = computeBannerPity(filler(63, "302"), "302");

    expect(state.pity).toBe(63);
    expect(state.softPityStart).toBe(63);
    expect(state.hardPity).toBe(80);
    expect(state.isSoftPity).toBe(true);
    expect(state.pullsToHardPity).toBe(17);
    expect(state.nextPullChance).toBeGreaterThan(WEAPON.baseRate5);
  });

  it("pity 62 sudah masuk soft pity karena pull berikutnya adalah pull ke-63", () => {
    const state = computeBannerPity(filler(62, "302"), "302");

    expect(state.nextPullNumber).toBe(63);
    expect(state.isSoftPity).toBe(true);
    expect(state.pullsToSoftPity).toBe(0);
  });

  it("pity 61 belum masuk soft pity", () => {
    const state = computeBannerPity(filler(61, "302"), "302");

    expect(state.isSoftPity).toBe(false);
    expect(state.nextPullChance).toBeCloseTo(0.007, 10);
  });

  it("senjata standard pool terdeteksi kalah 75/25, tapi TIDAK memberi guarantee", () => {
    const records = history(
      filler(10, "302"),
      fiveStar("302", "Skyward Harp", { itemType: "Weapon" }),
      filler(4, "302"),
    );

    const state = computeBannerPity(records, "302");

    expect(state.hasFeaturedMechanic).toBe(true);
    expect(state.last5Star?.wonFeatured).toBe(false);
    // Jaminan senjata hanya lewat Epitomized Path (fase 2), bukan dari kalah undian.
    expect(state.guaranteed).toBe(false);
    expect(state.guaranteedIsManual).toBe(false);
  });

  it("senjata featured dihitung menang 75/25", () => {
    const records = history(filler(3, "302"), fiveStar("302", "Splendor of Tranquil Waters", { itemType: "Weapon" }));

    const state = computeBannerPity(records, "302");

    expect(state.last5Star?.wonFeatured).toBe(true);
    expect(featuredChance(WEAPON, false)).toBeCloseTo(0.75, 10);
  });

  it("toggle manual tidak berlaku di banner senjata", () => {
    const state = computeBannerPity(filler(10, "302"), "302", { guaranteedOverride: true });

    expect(state.guaranteed).toBe(false);
  });

  it("pity 79 dijamin 5 bintang di pull berikutnya", () => {
    const state = computeBannerPity(filler(79, "302"), "302");

    expect(state.pullsToHardPity).toBe(1);
    expect(state.nextPullChance).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 8 - id tidak berurutan
// ---------------------------------------------------------------------------

describe("kriteria 8: record dengan id tidak berurutan", () => {
  it("urutan benar setelah sorting, bukan mengikuti urutan array", () => {
    const records = [
      makePull({ id: "1637787960000000005", gachaType: "301", rank: "3" }),
      makePull({ id: "1637787960000000002", gachaType: "301", rank: "5", name: "Furina", itemType: "Character" }),
      makePull({ id: "1637787960000000004", gachaType: "301", rank: "3" }),
      makePull({ id: "1637787960000000001", gachaType: "301", rank: "3" }),
      makePull({ id: "1637787960000000003", gachaType: "301", rank: "3" }),
    ];

    const state = computeBannerPity(records, "301");

    // 5 bintang ada di posisi kronologis ke-2, menyisakan 3 pull sesudahnya.
    expect(state.fiveStars[0]?.pity).toBe(2);
    expect(state.pity).toBe(3);
  });

  it("time yang berantakan tidak memengaruhi hasil - urutan hanya dari id", () => {
    const records = [
      makePull({ id: "1637787960000000001", gachaType: "301", rank: "3", time: "2026-05-05 00:00:00" }),
      makePull({ id: "1637787960000000002", gachaType: "301", rank: "5", name: "Furina", time: "2020-01-01 00:00:00" }),
      makePull({ id: "1637787960000000003", gachaType: "301", rank: "3", time: "2019-01-01 00:00:00" }),
    ];

    const state = computeBannerPity(records, "301");

    expect(state.fiveStars[0]?.pity).toBe(2);
    expect(state.pity).toBe(1);
  });

  it("id 19 digit dibandingkan tanpa kehilangan presisi", () => {
    const a = "1637787960000243756";
    const b = "1637787960000243757";

    // Number() akan menganggap keduanya sama - inilah jebakannya.
    expect(Number(a)).toBe(Number(b));
    expect(compareWishId(a, b)).toBeLessThan(0);
    expect(compareWishId(b, a)).toBeGreaterThan(0);
    expect(compareWishId(a, a)).toBe(0);
  });

  it("id dengan panjang berbeda diurutkan secara numerik, bukan leksikografis", () => {
    const sorted = sortByIdAsc([{ id: "100" }, { id: "99" }, { id: "1000" }, { id: "9" }]);

    expect(sorted.map((r) => r.id)).toEqual(["9", "99", "100", "1000"]);
  });
});

// ---------------------------------------------------------------------------
// Model probabilitas
// ---------------------------------------------------------------------------

describe("model probabilitas", () => {
  it("banner karakter: base rate sampai pull 73, naik dari 74, 100% di 90", () => {
    expect(fiveStarRateAt(1, CHARACTER)).toBeCloseTo(0.006, 10);
    expect(fiveStarRateAt(73, CHARACTER)).toBeCloseTo(0.006, 10);
    expect(fiveStarRateAt(74, CHARACTER)).toBeCloseTo(0.066, 10);
    expect(fiveStarRateAt(75, CHARACTER)).toBeCloseTo(0.126, 10);
    expect(fiveStarRateAt(90, CHARACTER)).toBe(1);
    expect(fiveStarRateAt(91, CHARACTER)).toBe(1);
  });

  it("banner senjata: base rate sampai pull 62, naik dari 63, 100% di 80", () => {
    expect(fiveStarRateAt(62, WEAPON)).toBeCloseTo(0.007, 10);
    expect(fiveStarRateAt(63, WEAPON)).toBeCloseTo(0.077, 10);
    expect(fiveStarRateAt(64, WEAPON)).toBeCloseTo(0.147, 10);
    expect(fiveStarRateAt(80, WEAPON)).toBe(1);
  });

  it("rate tidak pernah keluar dari rentang 0..1", () => {
    for (const banner of [CHARACTER, WEAPON]) {
      for (let n = 0; n <= banner.hardPity + 5; n++) {
        const rate = fiveStarRateAt(n, banner);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
    expect(fiveStarRateAt(0, CHARACTER)).toBe(0);
    expect(fiveStarRateAt(-3, CHARACTER)).toBe(0);
  });

  it("peluang kumulatif naik monoton dan mencapai 100% di hard pity", () => {
    let previous = 0;
    for (let n = 1; n <= CHARACTER.hardPity; n++) {
      const value = chanceWithin(0, n, CHARACTER);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(chanceWithin(0, CHARACTER.hardPity, CHARACTER)).toBe(1);
    expect(chanceWithin(0, 0, CHARACTER)).toBe(0);
  });

  it("peluang kumulatif 10 pull dari pity 0 mendekati 1 - 0.994^10", () => {
    expect(chanceWithin(0, 10, CHARACTER)).toBeCloseTo(1 - Math.pow(0.994, 10), 10);
  });

  it("dari pity tinggi, sedikit pull sudah hampir pasti", () => {
    expect(chanceWithin(73, 5, CHARACTER)).toBeGreaterThan(0.6);
    expect(chanceWithin(80, 10, CHARACTER)).toBe(1);
    expect(chanceWithin(70, 10, WEAPON)).toBe(1);
  });

  it("pullsToSoftPity nol tepat ketika soft pity aktif", () => {
    for (const banner of ["301", "302"] as const) {
      for (let pity = 0; pity <= 95; pity++) {
        const state = computeBannerPity(filler(pity, banner), banner);
        expect(state.isSoftPity).toBe(state.pullsToSoftPity === 0);
      }
    }
  });

  it("konversi primogem", () => {
    expect(PRIMOGEMS_PER_PULL).toBe(160);
    expect(pullsToPrimogems(17)).toBe(2720);
    expect(pullsToPrimogems(0)).toBe(0);
    expect(pullsToPrimogems(-5)).toBe(0);
    expect(primogemsToPulls(2720)).toBe(17);
    expect(primogemsToPulls(2719)).toBe(16);
    expect(primogemsToPulls(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Utilitas pendukung
// ---------------------------------------------------------------------------

describe("utilitas pendukung", () => {
  it("pity 4 bintang direset oleh 4 bintang maupun 5 bintang", () => {
    const state = computeBannerPity(
      history(filler(3, "301"), fourStar("301"), filler(2, "301")),
      "301",
    );
    expect(state.pity4).toBe(2);

    const afterFiveStar = computeBannerPity(
      history(filler(3, "301"), fiveStar("301", "Furina"), filler(1, "301")),
      "301",
    );
    expect(afterFiveStar.pity4).toBe(1);
  });

  it("dedupeAndSort membuang id ganda dan mengurutkan hasil gabungan", () => {
    const a = makePull({ id: "1637787960000000002", gachaType: "301", rank: "3" });
    const b = makePull({ id: "1637787960000000001", gachaType: "301", rank: "3" });
    const duplicate = makePull({ id: "1637787960000000002", gachaType: "301", rank: "3" });

    const merged = dedupeAndSort([a, duplicate], [b]);

    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.id)).toEqual([
      "1637787960000000001",
      "1637787960000000002",
    ]);
  });

  it("extractUids mengembalikan UID unik yang terurut", () => {
    const records = history(
      filler(2, "301", { uid: "800000000" }),
      filler(2, "301", { uid: "700000000" }),
      filler(1, "302", { uid: "800000000" }),
    );

    expect(extractUids(records)).toEqual(["700000000", "800000000"]);
    expect(extractUids([])).toEqual([]);
  });

  it("latestIdByRawType memisahkan cursor 301 dan 400", () => {
    const records = [
      makePull({ id: "1637787960000000001", gachaType: "301", rank: "3" }),
      makePull({ id: "1637787960000000009", gachaType: "301", rank: "3" }),
      makePull({ id: "1637787960000000005", gachaType: "400", rank: "3" }),
    ];

    expect(latestIdByRawType(records)).toEqual({
      "301": "1637787960000000009",
      "400": "1637787960000000005",
    });
  });

  it("data dua UID tidak saling mencampur saat disaring", () => {
    const records = history(
      filler(10, "301", { uid: "700000000" }),
      filler(40, "301", { uid: "800000000" }),
    );

    const first = computeBannerPity(records.filter((r) => r.uid === "700000000"), "301");
    const second = computeBannerPity(records.filter((r) => r.uid === "800000000"), "301");

    expect(first.pity).toBe(10);
    expect(second.pity).toBe(40);
  });
});
