/**
 * Statistik turunan: chart bulanan dan bahan tabel ringkasan.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  averagePity,
  busiestMonth,
  computeBannerStats,
  monthlyPulls,
  seriesTotal,
} from "./stats";
import { filler, fiveStar, fourStar, history, makePull, resetIdCursor } from "../test/fixtures";

beforeEach(() => {
  resetIdCursor();
});

describe("computeBannerStats", () => {
  it("mengumpulkan 5★ dan 4★ beserta pity masing-masing", () => {
    const records = history(
      filler(9, "301"),
      fourStar("301", "Bennett"),
      filler(5, "301"),
      fiveStar("301", "Furina"),
      filler(3, "301"),
    );

    const stats = computeBannerStats(records, "301");

    expect(stats.totalPulls).toBe(19);
    expect(stats.fourStars).toHaveLength(1);
    expect(stats.fourStars[0]?.pity).toBe(10);
    expect(stats.fiveStars).toHaveLength(1);
    expect(stats.fiveStars[0]?.pity).toBe(16);
  });

  it("301 dan 400 tetap dihitung sebagai satu urutan", () => {
    const records = history(filler(10, "301"), fiveStar("400", "Furina"), filler(2, "301"));

    const stats = computeBannerStats(records, "301");

    expect(stats.totalPulls).toBe(13);
    expect(stats.fiveStars[0]?.pity).toBe(11);
  });

  it("4★ dipecah jadi karakter dan senjata", () => {
    const records = history(
      fourStar("301", "Bennett", { itemType: "Character" }),
      fourStar("301", "Sacrificial Sword", { itemType: "Weapon" }),
      fourStar("301", "Xingqiu", { itemType: "Character" }),
    );

    const stats = computeBannerStats(records, "301");

    expect(stats.fourStarCharacters.map((p) => p.name)).toEqual(["Bennett", "Xingqiu"]);
    expect(stats.fourStarWeapons.map((p) => p.name)).toEqual(["Sacrificial Sword"]);
  });

  it("menang undian dihitung terpisah dari yang dijamin", () => {
    const records = history(
      filler(2, "301"),
      fiveStar("301", "Furina"), // menang 50/50
      filler(2, "301"),
      fiveStar("301", "Qiqi"), // kalah -> guaranteed aktif
      filler(2, "301"),
      fiveStar("301", "Neuvillette"), // dijamin, bukan undian
    );

    const stats = computeBannerStats(records, "301");

    expect(stats.fiveStars).toHaveLength(3);
    // Yang dijamin tidak ikut jadi penyebut maupun pembilang.
    expect(stats.fiveStarRolls.map((p) => p.name)).toEqual(["Furina", "Qiqi"]);
    expect(stats.fiveStarWins.map((p) => p.name)).toEqual(["Furina"]);
  });

  it("banner tanpa mekanik featured tidak punya undian sama sekali", () => {
    const records = history(filler(3, "200"), fiveStar("200", "Qiqi"));

    const stats = computeBannerStats(records, "200");

    expect(stats.fiveStars).toHaveLength(1);
    expect(stats.fiveStarRolls).toHaveLength(0);
    expect(stats.fiveStarWins).toHaveLength(0);
  });

  it("riwayat kosong tidak membuatnya crash", () => {
    const stats = computeBannerStats([], "301");

    expect(stats.totalPulls).toBe(0);
    expect(stats.fiveStars).toEqual([]);
    expect(stats.fourStars).toEqual([]);
  });

  it("rata-rata pity dihitung dari pity tiap pull", () => {
    const records = history(
      filler(9, "301"),
      fiveStar("301", "Furina"), // pity 10
      filler(29, "301"),
      fiveStar("301", "Neuvillette"), // pity 30
    );

    const stats = computeBannerStats(records, "301");

    expect(averagePity(stats.fiveStars)).toBe(20);
    expect(averagePity([])).toBeNull();
  });
});

describe("monthlyPulls", () => {
  it("mengelompokkan per bulan dan per seri banner", () => {
    const records = history(
      filler(3, "301", { time: "2026-07-05 10:00:00" }),
      filler(2, "400", { time: "2026-07-20 10:00:00" }),
      filler(4, "302", { time: "2026-08-01 10:00:00" }),
      filler(1, "200", { time: "2026-08-02 10:00:00" }),
    );

    const points = monthlyPulls(records, 2);

    expect(points.map((p) => p.key)).toEqual(["2026-07", "2026-08"]);
    expect(points[0]!.counts).toEqual({ character: 5, weapon: 0, standard: 0 });
    expect(points[1]!.counts).toEqual({ character: 0, weapon: 4, standard: 1 });
  });

  it("label sumbu berbentuk MM/YY", () => {
    const records = filler(1, "301", { time: "2026-01-15 10:00:00" });

    expect(monthlyPulls(records, 1)[0]!.label).toBe("01/26");
  });

  it("bulan tanpa pull tetap muncul sebagai celah", () => {
    const records = history(
      filler(1, "301", { time: "2026-06-01 10:00:00" }),
      filler(1, "301", { time: "2026-08-01 10:00:00" }),
    );

    const points = monthlyPulls(records, 3);

    expect(points.map((p) => p.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(points[1]!.counts.character).toBe(0);
  });

  it("rentang menyeberang tahun tanpa salah hitung", () => {
    const records = history(
      filler(1, "301", { time: "2025-12-01 10:00:00" }),
      filler(1, "301", { time: "2026-01-01 10:00:00" }),
    );

    expect(monthlyPulls(records, 2).map((p) => p.key)).toEqual(["2025-12", "2026-01"]);
  });

  it("time tidak pernah dilewatkan Date — jam 00:30 tetap di bulannya sendiri", () => {
    // Kalau time diparse sebagai Date lalu dibaca dalam zona waktu negatif,
    // tanggal 1 pukul 00:30 akan mundur ke bulan sebelumnya.
    const records = filler(1, "301", { time: "2026-03-01 00:30:00" });

    expect(monthlyPulls(records, 1)[0]!.key).toBe("2026-03");
  });

  it("record dengan time cacat dilewati, bukan bikin crash", () => {
    const records = [
      makePull({ gachaType: "301", rank: "3", time: "" }),
      makePull({ gachaType: "301", rank: "3", time: "bukan tanggal" }),
      makePull({ gachaType: "301", rank: "3", time: "2026-08-01 10:00:00" }),
    ];

    const points = monthlyPulls(records, 1);

    expect(points).toHaveLength(1);
    expect(points[0]!.counts.character).toBe(1);
  });

  it("riwayat kosong menghasilkan daftar kosong", () => {
    expect(monthlyPulls([], 13)).toEqual([]);
  });

  it("total dan bulan tersibuk dihitung per seri", () => {
    const records = history(
      filler(3, "301", { time: "2026-07-05 10:00:00" }),
      filler(9, "301", { time: "2026-08-05 10:00:00" }),
      filler(4, "302", { time: "2026-07-05 10:00:00" }),
    );

    const points = monthlyPulls(records, 2);

    expect(seriesTotal(points, "character")).toBe(12);
    expect(seriesTotal(points, "weapon")).toBe(4);
    expect(busiestMonth(points, "character")?.label).toBe("08/26");
    expect(busiestMonth(points, "weapon")?.label).toBe("07/26");
    expect(busiestMonth(points, "standard")).toBeNull();
  });
});
