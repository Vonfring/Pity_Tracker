/**
 * Pembuat riwayat wish buatan untuk test.
 *
 * id dinaikkan satu per satu memakai BigInt supaya tetap presisi di 19 digit —
 * persis seperti id asli dari HoYoverse.
 */

import type { WishRecord } from "../types/wish";

/** Basis id yang panjangnya sama dengan id asli (19 digit). */
export const BASE_ID = 1637787960000000000n;

let cursor = BASE_ID;

/** Reset penomoran id. Panggil di beforeEach kalau urutan id antar test perlu bersih. */
export function resetIdCursor(): void {
  cursor = BASE_ID;
}

export function nextId(): string {
  cursor += 1n;
  return cursor.toString();
}

export interface PullSpec {
  /** Kode banner MENTAH — pakai "400" kalau ingin menguji peleburan 301+400. */
  gachaType: string;
  rank: "3" | "4" | "5";
  name?: string;
  itemType?: string;
  uid?: string;
  time?: string;
  /** Paksa id tertentu (untuk menguji urutan yang berantakan). */
  id?: string;
}

export function makePull(spec: PullSpec): WishRecord {
  const rank = spec.rank;
  const fallbackName = rank === "5" ? "Some 5star" : rank === "4" ? "Some 4star" : "Sacrificial Bow";
  return {
    id: spec.id ?? nextId(),
    uid: spec.uid ?? "700000000",
    gacha_type: spec.gachaType,
    item_id: "",
    count: "1",
    time: spec.time ?? "2026-01-01 12:00:00",
    name: spec.name ?? fallbackName,
    lang: "en-us",
    item_type: spec.itemType ?? "Weapon",
    rank_type: rank,
  };
}

/** Sejumlah pull 3-bintang berturut-turut di satu banner. */
export function filler(count: number, gachaType: string, overrides: Partial<PullSpec> = {}): WishRecord[] {
  return Array.from({ length: count }, () => makePull({ gachaType, rank: "3", ...overrides }));
}

/** Satu pull 5-bintang. */
export function fiveStar(gachaType: string, name: string, overrides: Partial<PullSpec> = {}): WishRecord {
  return makePull({ gachaType, rank: "5", name, itemType: "Character", ...overrides });
}

/** Satu pull 4-bintang. */
export function fourStar(gachaType: string, name = "Bennett", overrides: Partial<PullSpec> = {}): WishRecord {
  return makePull({ gachaType, rank: "4", name, itemType: "Character", ...overrides });
}

/** Gabungkan beberapa potongan riwayat menjadi satu array. */
export function history(...parts: Array<WishRecord | WishRecord[]>): WishRecord[] {
  return parts.flat();
}
