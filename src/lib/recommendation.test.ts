import { describe, expect, it } from "vitest";

import { COPY, LOCALES } from "../config/copy";
import {
  featuredOutcomeTone,
  formatAverage,
  formatChance,
  formatNumber,
  formatPercent,
  formatPity,
  formatPrimogems,
  formatRelativeTime,
  getFeaturedNote,
  getRecommendation,
} from "./recommendation";
import { computeBannerPity } from "./pity";
import { filler, fiveStar, history, resetIdCursor } from "../test/fixtures";

const ID = COPY.id;
const EN = COPY.en;

function characterState(pulls: number, last5Star?: string) {
  resetIdCursor();
  const records = last5Star
    ? history(filler(5, "301"), fiveStar("301", last5Star), filler(pulls, "301"))
    : filler(pulls, "301");
  return computeBannerPity(records, "301");
}

describe("kalimat rekomendasi", () => {
  it("banner kosong mengajak import, bukan memberi saran ngawur", () => {
    const recommendation = getRecommendation(computeBannerPity([], "301"), ID);

    expect(recommendation.tone).toBe("neutral");
    expect(recommendation.text).toBe(ID.advice.noData);
  });

  it("pity jauh: menyarankan menabung dan menyebut sisa pull", () => {
    const state = characterState(10);
    const recommendation = getRecommendation(state, ID);

    expect(recommendation.tone).toBe("hold");
    expect(recommendation.text).toBe(ID.advice.nearSoftPity(state.pullsToSoftPity));
    expect(recommendation.text).toMatch(/\d+ pull/);
  });

  it("sudah soft pity: mendorong pull", () => {
    const recommendation = getRecommendation(characterState(75), ID);

    expect(recommendation.tone).toBe("pull");
    expect(recommendation.text).toBe(ID.advice.luckyZone);
  });

  it("satu pull lagi dari hard pity: menyebut jaminan", () => {
    const recommendation = getRecommendation(characterState(89), ID);

    expect(recommendation.tone).toBe("pull");
    expect(recommendation.text).toBe(ID.advice.nextIsGuaranteed);
  });

  it("status guaranteed mengubah kalimat zona hoki", () => {
    const state = characterState(75, "Qiqi");

    expect(state.guaranteed).toBe(true);
    expect(getRecommendation(state, ID).text).toBe(ID.advice.luckyZoneGuaranteed);
  });

  it("banner senjata memakai hard pity 80 dalam kalimatnya", () => {
    resetIdCursor();
    const state = computeBannerPity(filler(75, "302"), "302");

    expect(state.pullsToHardPity).toBe(5);
    expect(getRecommendation(state, ID).text).toBe(ID.advice.almostGuaranteed(5));
  });

  it("cabangnya identik di kedua bahasa", () => {
    const cases = [0, 10, 40, 73, 75, 85, 89];

    for (const pity of cases) {
      const state = characterState(pity);
      const id = getRecommendation(state, ID);
      const en = getRecommendation(state, EN);

      // Nadanya harus sama; hanya teksnya yang berbeda.
      expect(en.tone).toBe(id.tone);
      expect(en.text).not.toBe(id.text);
    }
  });

  it("tidak ada kalimat yang memakai jargon tanpa penjelasan", () => {
    for (const copy of [ID, EN]) {
      const samples = [0, 10, 40, 73, 75, 85, 89].map(
        (n) => getRecommendation(characterState(n), copy).text,
      );

      for (const text of samples) {
        expect(text).not.toMatch(/cumulative|probability|threshold|n=/i);
        expect(text.length).toBeLessThan(120);
      }
    }
  });
});

describe("catatan peluang featured", () => {
  it("banner tanpa mekanik featured mengatakannya apa adanya", () => {
    resetIdCursor();
    const state = computeBannerPity(filler(10, "200"), "200");

    expect(getFeaturedNote(state, ID)).toBe(ID.featured.none);
  });

  it("status guaranteed menggantikan angka peluang", () => {
    expect(getFeaturedNote(characterState(10, "Qiqi"), ID)).toBe(ID.featured.guaranteed);
  });

  it("selain itu menyebut rate featured efektif", () => {
    expect(getFeaturedNote(characterState(10, "Furina"), ID)).toBe(ID.featured.chance("55%"));
  });

  it("banner senjata memakai 75%", () => {
    resetIdCursor();
    const state = computeBannerPity(filler(10, "302"), "302");

    expect(getFeaturedNote(state, ID)).toBe(ID.featured.chance("75%"));
  });
});

describe("file locale", () => {
  it("kedua bahasa punya struktur kunci yang sama persis", () => {
    expect(shape(ID)).toEqual(shape(EN));
  });

  it("tidak ada teks yang tertinggal kosong", () => {
    for (const locale of LOCALES) {
      for (const [path, value] of flatten(COPY[locale])) {
        expect(value, `${locale}: ${path}`).not.toBe("");
      }
    }
  });

  it("glosarium mencakup istilah yang dipakai UI, di kedua bahasa", () => {
    for (const locale of LOCALES) {
      for (const term of ["pity", "soft pity", "hard pity", "50/50", "75/25", "guaranteed", "primogem", "uid"]) {
        expect(COPY[locale].glossary[term]!.length).toBeGreaterThan(20);
      }
    }
  });

  it("nama banner tersedia untuk seluruh kode banner", () => {
    for (const locale of LOCALES) {
      for (const id of ["301", "302", "200", "500", "100"]) {
        expect(COPY[locale].banner.names[id]).toBeTruthy();
        expect(COPY[locale].banner.tags[id]).toBeTruthy();
      }
    }
  });
});

/** Bentuk objek tanpa nilainya — untuk membandingkan dua bahasa. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === "function") return "fn";
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
    );
  }
  return typeof value;
}

/** Seluruh string di dalam objek, beserta jalurnya. */
function flatten(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") return [];
  if (Array.isArray(value)) return value.flatMap((item, i) => flatten(item, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flatten(item, path ? `${path}.${key}` : key));
  }
  return [];
}

describe("format", () => {
  it("pity selalu ditulis lengkap dengan konteksnya", () => {
    expect(formatPity(characterState(47))).toBe("47 / 90");
    resetIdCursor();
    expect(formatPity(computeBannerPity(filler(47, "302"), "302"))).toBe("47 / 80");
  });

  it("peluang dibulatkan dan tidak menampilkan 100% palsu", () => {
    expect(formatChance(1)).toBe("100%");
    expect(formatChance(0.9999)).toBe("100%");
    expect(formatChance(0.994)).toBe("99%");
    expect(formatChance(0.005)).toBe("<1%");
    expect(formatChance(0)).toBe("0%");
    expect(formatChance(0.55)).toBe("55%");
  });

  it("persentase tabel mengikuti besaran angkanya", () => {
    expect(formatPercent(14, 812)).toBe("1.72%");
    expect(formatPercent(96, 812)).toBe("11.8%");
    expect(formatPercent(8, 14)).toBe("57.1%");
    expect(formatPercent(1, 0)).toBe("—");
  });

  it("rata-rata pity dipangkas satu desimal", () => {
    expect(formatAverage(62)).toBe("62");
    expect(formatAverage(7.42857)).toBe("7.4");
    expect(formatAverage(null)).toBe("—");
  });

  it("pemisah ribuan mengikuti bahasa", () => {
    expect(formatNumber(1416, "id")).toBe("1.416");
    expect(formatNumber(1416, "en")).toBe("1,416");
  });

  it("primogem dihitung 160 per pull", () => {
    expect(formatPrimogems(1, "id")).toBe("160");
    expect(formatPrimogems(90, "id")).toBe("14.400");
    expect(formatPrimogems(90, "en")).toBe("14,400");
    expect(formatPrimogems(0, "id")).toBe("0");
  });

  it("hasil undian featured diberi nada yang benar", () => {
    expect(featuredOutcomeTone(true, false)).toBe("win");
    expect(featuredOutcomeTone(false, false)).toBe("lose");
    expect(featuredOutcomeTone(null, true)).toBe("neutral");
    expect(featuredOutcomeTone(null, false)).toBe("neutral");
  });

  it("waktu relatif memakai teks dari locale", () => {
    const now = Date.parse("2026-08-23T12:00:00.000Z");

    expect(formatRelativeTime("2026-08-23T11:58:00.000Z", ID, now)).toBe(ID.header.minutesAgo(2));
    expect(formatRelativeTime("2026-08-23T10:00:00.000Z", ID, now)).toBe(ID.header.hoursAgo(2));
    expect(formatRelativeTime("2026-08-22T10:00:00.000Z", ID, now)).toBe(ID.header.yesterday);
    expect(formatRelativeTime("2026-08-23T11:59:50.000Z", EN, now)).toBe(EN.header.justNow);
    expect(formatRelativeTime("bukan tanggal", ID, now)).toBe(ID.header.justNow);
  });
});
