/**
 * Kalimat rekomendasi dan pemformatan angka untuk tampilan.
 *
 * Logika murni, tanpa JSX — supaya bisa diuji tanpa merender apa pun.
 * Seluruh teksnya datang dari src/config/copy.ts; file ini hanya memilih
 * cabang mana yang dipakai, jadi kedua bahasa tidak mungkin bercabang beda.
 */

import { PRIMOGEMS_PER_PULL } from "../config/gacha";
import { DEFAULT_LOCALE, numberLocale, type Copy, type Locale } from "../config/copy";
import type { BannerPityState } from "../types/wish";
import { getBannerConfig } from "./pity";

export type RecommendationTone = "pull" | "hold" | "neutral";

export interface Recommendation {
  text: string;
  tone: RecommendationTone;
}

/**
 * Kalimat rekomendasi untuk satu kartu banner.
 *
 * Urutan cabangnya mengikat — test menguji tiap cabang, dan copy.ts hanya
 * menyediakan kalimatnya, bukan keputusannya.
 */
export function getRecommendation(state: BannerPityState, copy: Copy): Recommendation {
  const banner = getBannerConfig(state.bannerId);
  const advice = copy.advice;

  if (state.totalPulls === 0) {
    return { text: advice.noData, tone: "neutral" };
  }

  if (state.pullsToHardPity <= 1) {
    return { text: advice.nextIsGuaranteed, tone: "pull" };
  }

  if (state.pullsToHardPity <= 10) {
    return { text: advice.almostGuaranteed(state.pullsToHardPity), tone: "pull" };
  }

  if (state.isSoftPity) {
    return {
      text: state.guaranteed ? advice.luckyZoneGuaranteed : advice.luckyZone,
      tone: "pull",
    };
  }

  if (!banner.hasFeaturedMechanic && state.pullsToSoftPity > 40) {
    return { text: advice.farFromSoftPity(state.pullsToSoftPity), tone: "hold" };
  }

  return { text: advice.nearSoftPity(state.pullsToSoftPity), tone: "hold" };
}

/** Catatan peluang featured di panel detail. */
export function getFeaturedNote(state: BannerPityState, copy: Copy): string {
  const banner = getBannerConfig(state.bannerId);
  if (!banner.hasFeaturedMechanic) return copy.featured.none;
  if (state.guaranteed) return copy.featured.guaranteed;
  return copy.featured.chance(formatChance(banner.effectiveFeaturedRate));
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/** Peluang dibulatkan, tanpa 100% palsu di bawah ambang. */
export function formatChance(value: number): string {
  if (value >= 0.9995) return "100%";
  if (value <= 0) return "0%";
  if (value < 0.01) return "<1%";
  return `${Math.round(value * 100)}%`;
}

/** Persentase satu angka desimal, untuk tabel ringkasan. */
export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return "—";
  const value = (part / whole) * 100;
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

export function formatNumber(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return value.toLocaleString(numberLocale(locale));
}

/** Jumlah pull dalam primogem. */
export function formatPrimogems(pulls: number, locale: Locale = DEFAULT_LOCALE): string {
  return formatNumber(Math.max(0, pulls) * PRIMOGEMS_PER_PULL, locale);
}

/** Rata-rata pity, satu desimal, atau em dash kalau tidak ada datanya. */
export function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Pity selalu ditulis "47 / 90" supaya konteksnya jelas tanpa penjelasan. */
export function formatPity(state: BannerPityState): string {
  return `${state.pity} / ${state.hardPity}`;
}

export type OutcomeTone = "win" | "lose" | "neutral";

/**
 * Warna chip 5★: menang undian, kalah, atau tidak berlaku.
 * Dipakai tabel ringkasan — bukan label teks, hanya nadanya.
 */
export function featuredOutcomeTone(
  wonFeatured: boolean | null,
  wasGuaranteed: boolean,
): OutcomeTone {
  if (wasGuaranteed) return "neutral";
  if (wonFeatured === true) return "win";
  if (wonFeatured === false) return "lose";
  return "neutral";
}

/**
 * Waktu relatif untuk header.
 * Teksnya dari copy, perhitungannya di sini.
 */
export function formatRelativeTime(iso: string, copy: Copy, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return copy.header.justNow;
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return copy.header.justNow;
  if (minutes < 60) return copy.header.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.header.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return days === 1 ? copy.header.yesterday : copy.header.daysAgo(days);
}
