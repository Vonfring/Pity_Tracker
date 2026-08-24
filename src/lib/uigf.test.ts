/**
 * Acceptance criteria 15-17 (UIGF).
 *
 * Kriteria 15 diuji terhadap SCHEMA RESMI UIGF yang disalin apa adanya ke
 * src/test/uigf-v4-schema.json (sumber: https://uigf.org/en/standards/uigf.html,
 * diambil Agustus 2026, versi v4.2). Memvalidasi dengan validator buatan sendiri
 * saja tidak membuktikan apa-apa — kalau pemahamanku salah, validatorku ikut salah.
 */

import Ajv2020 from "ajv/dist/2020";
import { beforeEach, describe, expect, it } from "vitest";

import schema from "../test/uigf-v4-schema.json";
import {
  UIGF_VERSION,
  UigfParseError,
  buildUigfDocument,
  parseUigf,
  serializeUigf,
  suggestExportFilename,
  timezoneForUid,
  validateUigfDocument,
} from "./uigf";
import { computeAllPity, computeBannerPity } from "./pity";
import { filler, fiveStar, history, resetIdCursor } from "../test/fixtures";
import type { WishRecord } from "../types/wish";

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateAgainstOfficialSchema = ajv.compile(schema);

const EXPORT_OPTIONS = { appVersion: "0.1.0", exportTimestamp: 1_755_820_800 };

function sampleHistory(uid = "800000001"): WishRecord[] {
  return history(
    filler(20, "301", { uid }),
    fiveStar("301", "Qiqi", { uid }),
    filler(12, "400", { uid }),
    filler(30, "302", { uid }),
    fiveStar("302", "Skyward Harp", { uid, itemType: "Weapon" }),
    filler(5, "200", { uid }),
  );
}

beforeEach(() => {
  resetIdCursor();
});

// ---------------------------------------------------------------------------
// Kriteria 15 - export valid
// ---------------------------------------------------------------------------

describe("kriteria 15: export sesuai schema UIGF v4.x", () => {
  it("lolos validasi schema resmi UIGF", () => {
    const doc = buildUigfDocument(
      [{ uid: "800000001", records: sampleHistory() }],
      EXPORT_OPTIONS,
    );

    const valid = validateAgainstOfficialSchema(doc);
    expect(validateAgainstOfficialSchema.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it("info berisi keempat field wajib dan versi berbentuk v{major}.{minor}", () => {
    const doc = buildUigfDocument([{ uid: "800000001", records: sampleHistory() }], EXPORT_OPTIONS);

    expect(doc.info).toEqual({
      export_timestamp: 1_755_820_800,
      export_app: "genshin-pity-tracker",
      export_app_version: "0.1.0",
      version: UIGF_VERSION,
    });
    expect(doc.info.version).toMatch(/^v4\.\d+$/);
  });

  it("tiap record memuat kelima field wajib, dan 400 dinormalisasi di uigf_gacha_type", () => {
    const doc = buildUigfDocument([{ uid: "800000001", records: sampleHistory() }], EXPORT_OPTIONS);
    const list = doc.hk4e![0]!.list;

    for (const record of list) {
      expect(typeof record.uigf_gacha_type).toBe("string");
      expect(typeof record.gacha_type).toBe("string");
      expect(typeof record.item_id).toBe("string");
      expect(record.time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(record.id).toMatch(/^\d{1,19}$/);
    }

    const dari400 = list.filter((r) => r.gacha_type === "400");
    expect(dari400.length).toBe(12);
    // gacha_type mentah dipertahankan, uigf_gacha_type dilebur ke 301.
    expect(dari400.every((r) => r.uigf_gacha_type === "301")).toBe(true);
  });

  it("record terurut naik berdasarkan id dan duplikat dibuang", () => {
    const records = sampleHistory();
    const doc = buildUigfDocument(
      [{ uid: "800000001", records: [...records, ...records] }],
      EXPORT_OPTIONS,
    );
    const list = doc.hk4e![0]!.list;

    expect(list).toHaveLength(records.length);
    expect(list.map((r) => r.id)).toEqual([...list.map((r) => r.id)].sort());
  });

  it("timezone ditebak dari UID sesuai region", () => {
    expect(timezoneForUid("800000001")).toBe(8); // Asia
    expect(timezoneForUid("600000001")).toBe(-5); // America
    expect(timezoneForUid("700000001")).toBe(1); // Europe
    expect(timezoneForUid("900000001")).toBe(8); // TW/HK/MO
    expect(timezoneForUid("1800000001")).toBe(8); // Asia, UID 10 digit
    expect(timezoneForUid("1600000001")).toBe(-5);
    expect(timezoneForUid("1700000001")).toBe(1);
    expect(timezoneForUid("100000001")).toBe(8); // CN
  });

  it("timezone eksplisit menimpa hasil tebakan", () => {
    const doc = buildUigfDocument(
      [{ uid: "600000001", records: sampleHistory("600000001"), timezone: -5 }],
      EXPORT_OPTIONS,
    );

    expect(doc.hk4e![0]!.timezone).toBe(-5);
  });

  it("beberapa akun bisa diekspor dalam satu file", () => {
    const doc = buildUigfDocument(
      [
        { uid: "800000001", records: sampleHistory("800000001") },
        { uid: "600000002", records: sampleHistory("600000002") },
      ],
      EXPORT_OPTIONS,
    );

    expect(validateAgainstOfficialSchema(doc)).toBe(true);
    expect(doc.hk4e).toHaveLength(2);
    expect(doc.hk4e!.map((a) => a.uid)).toEqual(["800000001", "600000002"]);
  });

  it("hasil serialisasi berupa JSON yang bisa dibaca ulang", () => {
    const doc = buildUigfDocument([{ uid: "800000001", records: sampleHistory() }], EXPORT_OPTIONS);
    const text = serializeUigf(doc);

    expect(() => JSON.parse(text)).not.toThrow();
    expect(validateAgainstOfficialSchema(JSON.parse(text))).toBe(true);
    expect(validateUigfDocument(JSON.parse(text))).toEqual([]);
  });

  it("nama file menjelaskan isinya", () => {
    expect(suggestExportFilename("800000001", "2026-08-22")).toBe(
      "UIGF4_800000001_2026-08-22.json",
    );
  });

  it("file export tidak memuat authkey", () => {
    const doc = buildUigfDocument([{ uid: "800000001", records: sampleHistory() }], EXPORT_OPTIONS);
    expect(serializeUigf(doc).toLowerCase()).not.toContain("authkey");
  });
});

// ---------------------------------------------------------------------------
// Kriteria 16 - round trip
// ---------------------------------------------------------------------------

describe("kriteria 16: export lalu import menghasilkan pity identik", () => {
  it("pity seluruh banner sama persis sebelum dan sesudah round trip", () => {
    const original = sampleHistory();
    const before = computeAllPity(original);

    const text = serializeUigf(
      buildUigfDocument([{ uid: "800000001", records: original }], EXPORT_OPTIONS),
    );
    const after = computeAllPity(parseUigf(text).accounts[0]!.records);

    for (const id of ["301", "302", "200", "500", "100"] as const) {
      expect(after[id].pity).toBe(before[id].pity);
      expect(after[id].totalPulls).toBe(before[id].totalPulls);
      expect(after[id].guaranteed).toBe(before[id].guaranteed);
      expect(after[id].fiveStars.map((f) => f.name)).toEqual(before[id].fiveStars.map((f) => f.name));
    }
  });

  it("gacha_type 400 selamat melewati round trip, bukan berubah jadi 301", () => {
    const original = history(filler(3, "301"), filler(4, "400"));

    const text = serializeUigf(
      buildUigfDocument([{ uid: "800000001", records: original }], EXPORT_OPTIONS),
    );
    const roundTripped = parseUigf(text).accounts[0]!.records;

    expect(roundTripped.filter((r) => r.gacha_type === "400")).toHaveLength(4);
    expect(computeBannerPity(roundTripped, "301").totalPulls).toBe(7);
  });

  it("time tidak pernah dikonversi ke Date", () => {
    const original = history(filler(1, "301", { time: "2026-02-28 23:59:59" }));

    const text = serializeUigf(
      buildUigfDocument([{ uid: "800000001", records: original }], EXPORT_OPTIONS),
    );

    expect(JSON.parse(text).hk4e[0].list[0].time).toBe("2026-02-28 23:59:59");
    expect(parseUigf(text).accounts[0]!.records[0]!.time).toBe("2026-02-28 23:59:59");
  });

  it("dua akun tetap terpisah setelah round trip", () => {
    const doc = buildUigfDocument(
      [
        { uid: "800000001", records: filler(10, "301", { uid: "800000001" }) },
        { uid: "600000002", records: filler(40, "301", { uid: "600000002" }) },
      ],
      EXPORT_OPTIONS,
    );

    const parsed = parseUigf(serializeUigf(doc));

    expect(parsed.accounts).toHaveLength(2);
    expect(computeBannerPity(parsed.accounts[0]!.records, "301").pity).toBe(10);
    expect(computeBannerPity(parsed.accounts[1]!.records, "301").pity).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Kriteria 17 - file dari tool lain
// ---------------------------------------------------------------------------

describe("kriteria 17: file UIGF dari tool lain", () => {
  it("uid dan export_timestamp bertipe integer tetap diterima", () => {
    const dariToolLain = {
      info: {
        export_timestamp: 1_755_820_800,
        export_app: "tool_lain",
        export_app_version: "2.0",
        version: "v4.0",
      },
      hk4e: [
        {
          uid: 800000001,
          timezone: 8,
          lang: "en-us",
          list: [
            {
              uigf_gacha_type: "301",
              gacha_type: "400",
              item_id: "10000042",
              count: "1",
              time: "2026-01-01 10:00:00",
              name: "Keqing",
              item_type: "Character",
              rank_type: "5",
              id: "1637787960000000001",
            },
          ],
        },
      ],
    };

    const parsed = parseUigf(JSON.stringify(dariToolLain));

    expect(parsed.accounts[0]!.uid).toBe("800000001");
    expect(parsed.accounts[0]!.records[0]!.gacha_type).toBe("400");
    expect(computeBannerPity(parsed.accounts[0]!.records, "301").guaranteed).toBe(true);
  });

  it("field opsional yang hilang tidak membuat import gagal", () => {
    const minimal = {
      info: {
        export_timestamp: "1755820800",
        export_app: "tool_minimalis",
        export_app_version: "1.0",
        version: "v4.2",
      },
      hk4e: [
        {
          uid: "800000001",
          timezone: 8,
          list: [
            {
              uigf_gacha_type: "301",
              gacha_type: "301",
              item_id: "10000002",
              time: "2026-01-01 10:00:00",
              id: "1637787960000000001",
            },
          ],
        },
      ],
    };

    const parsed = parseUigf(JSON.stringify(minimal));

    expect(parsed.accounts[0]!.records).toHaveLength(1);
    expect(parsed.warnings.join(" ")).toContain("bintang");
    // Tanpa rank_type, record tetap terhitung sebagai pull biasa.
    expect(computeBannerPity(parsed.accounts[0]!.records, "301").pity).toBe(1);
  });

  it("record cacat dilewati, sisanya tetap masuk", () => {
    const campuran = {
      info: {
        export_timestamp: 1,
        export_app: "x",
        export_app_version: "1",
        version: "v4.1",
      },
      hk4e: [
        {
          uid: "800000001",
          timezone: 8,
          list: [
            { uigf_gacha_type: "301", gacha_type: "301", item_id: "", time: "", id: "" },
            "bukan objek",
            {
              uigf_gacha_type: "301",
              gacha_type: "301",
              item_id: "",
              time: "2026-01-01 10:00:00",
              rank_type: "3",
              id: "1637787960000000002",
            },
          ],
        },
      ],
    };

    const parsed = parseUigf(JSON.stringify(campuran));

    expect(parsed.accounts[0]!.records).toHaveLength(1);
    expect(parsed.warnings.join(" ")).toContain("dilewati");
  });

  it("uigf_gacha_type dipakai kalau gacha_type tidak ada", () => {
    const doc = {
      info: { export_timestamp: 1, export_app: "x", export_app_version: "1", version: "v4.0" },
      hk4e: [
        {
          uid: "800000001",
          timezone: 8,
          list: [
            {
              uigf_gacha_type: "302",
              item_id: "",
              time: "2026-01-01 10:00:00",
              rank_type: "3",
              id: "1637787960000000001",
            },
          ],
        },
      ],
    };

    const parsed = parseUigf(JSON.stringify(doc));
    expect(parsed.accounts[0]!.records[0]!.gacha_type).toBe("302");
  });

  it("timezone yang hilang ditebak dari UID", () => {
    const doc = {
      info: { export_timestamp: 1, export_app: "x", export_app_version: "1", version: "v4.0" },
      hk4e: [{ uid: "600000001", list: [] }],
    };

    expect(parseUigf(JSON.stringify(doc)).accounts[0]!.timezone).toBe(-5);
  });
});

describe("pesan error import UIGF", () => {
  it("file bukan JSON", () => {
    const error = grabParseError("ini bukan json");
    expect(error.kind).toBe("invalid_json");
    expect(error.userMessage).toContain("JSON");
  });

  it("JSON valid tapi bukan UIGF", () => {
    expect(grabParseError(JSON.stringify({ halo: "dunia" })).kind).toBe("not_uigf");
  });

  it("UIGF v3 ditolak dengan pesan yang menyebut versinya", () => {
    const v3 = { info: { uid: "1", lang: "en-us", uigf_version: "v3.0", version: "v3.0" }, list: [] };
    const error = grabParseError(JSON.stringify(v3));

    expect(error.kind).toBe("unsupported_version");
    expect(error.userMessage).toContain("v3.0");
    expect(error.userMessage).toContain("v4");
  });

  it("file v4 tanpa data Genshin ditolak dengan jelas", () => {
    const hanyaHsr = {
      info: { export_timestamp: 1, export_app: "x", export_app_version: "1", version: "v4.2" },
      hkrpg: [{ uid: "1", timezone: 8, list: [] }],
    };

    expect(grabParseError(JSON.stringify(hanyaHsr)).kind).toBe("no_genshin_data");
  });

  it("seluruh pesan error berbahasa manusia, bukan istilah teknis", () => {
    for (const bad of ["bukan json", JSON.stringify({ halo: 1 })]) {
      const error = grabParseError(bad);
      expect(error.userMessage).not.toMatch(/undefined|null|TypeError|SyntaxError/);
      expect(error.userMessage.length).toBeGreaterThan(20);
    }
  });
});

function grabParseError(text: string): UigfParseError {
  try {
    parseUigf(text);
  } catch (error) {
    return error as UigfParseError;
  }
  throw new Error("seharusnya melempar error");
}

describe("validateUigfDocument", () => {
  it("menemukan field wajib yang hilang", () => {
    const issues = validateUigfDocument({ info: { export_app: "x" } });
    const paths = issues.map((i) => i.path);

    expect(paths).toContain("info.export_timestamp");
    expect(paths).toContain("info.version");
  });

  it("menolak kode banner yang tidak dikenal", () => {
    const doc = {
      info: { export_timestamp: 1, export_app: "x", export_app_version: "1", version: "v4.2" },
      hk4e: [
        {
          uid: "1",
          timezone: 8,
          list: [
            {
              uigf_gacha_type: "999",
              gacha_type: "999",
              item_id: "",
              time: "2026-01-01 10:00:00",
              id: "1",
            },
          ],
        },
      ],
    };

    const paths = validateUigfDocument(doc).map((i) => i.path);
    expect(paths).toContain("hk4e[0].list[0].uigf_gacha_type");
    expect(paths).toContain("hk4e[0].list[0].gacha_type");
  });

  it("sepakat dengan schema resmi untuk dokumen hasil export kita", () => {
    const doc = buildUigfDocument([{ uid: "800000001", records: sampleHistory() }], EXPORT_OPTIONS);

    expect(validateUigfDocument(doc)).toEqual([]);
    expect(validateAgainstOfficialSchema(doc)).toBe(true);
  });
});
