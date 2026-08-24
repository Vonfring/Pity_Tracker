import { useCopy } from "../hooks/useCopy";
import {
  featuredOutcomeTone,
  formatAverage,
  formatNumber,
  formatPercent,
} from "../lib/recommendation";
import { averagePity, type BannerStats, type RankedPull } from "../lib/stats";

export interface SummaryRow {
  key: string;
  label: string;
  total: number;
  /** Persen sudah jadi teks karena penyebutnya berbeda-beda per baris. */
  percent: string;
  average: string;
  tone: "five" | "four";
  nested: boolean;
}

interface SummaryTableProps {
  title: string;
  rows: SummaryRow[];
  chips: RankedPull[];
}

const CHIP_STYLE: Record<string, string> = {
  win: "border-[oklch(0.5_0.1_88)] text-gold",
  lose: "border-[oklch(0.45_0.08_30)] text-red",
  neutral: "border-[oklch(0.4_0.03_285)] text-ink-muted",
};

export function SummaryTable({ title, rows, chips }: SummaryTableProps) {
  const { copy, locale } = useCopy();

  return (
    <article className="rounded-[18px] border border-line bg-card p-[18px]">
      <table aria-label={title} className="w-full border-collapse">
        <thead>
          <tr className="text-[11px] tracking-[0.06em] text-ink-faint uppercase">
            <th
              scope="col"
              className="pb-2.5 text-left font-display text-[17px] font-semibold tracking-[-0.01em] normal-case text-ink"
            >
              {title}
            </th>
            <th scope="col" className="pb-2.5 text-right font-medium">
              {copy.tables.total}
            </th>
            <th scope="col" className="pb-2.5 text-right font-medium">
              {copy.tables.percent}
            </th>
            <th scope="col" className="pb-2.5 text-right font-medium">
              {copy.tables.avgPity}
            </th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.length === 0 ? (
            <tr className="border-t border-divider">
              <td colSpan={4} className="py-2.5 text-sm text-ink-muted">
                {copy.tables.empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const color = row.tone === "five" ? "text-gold" : "text-purple";
              return (
                <tr key={row.key} className="border-t border-divider">
                  <td className={`py-2.5 text-sm ${color} ${row.nested ? "pl-4" : ""}`}>
                    {row.nested ? (
                      <span aria-hidden className="mr-1 text-ink-faint">
                        ↳
                      </span>
                    ) : null}
                    {row.label}
                  </td>
                  <td className={`py-2.5 text-right text-sm ${color}`}>
                    {formatNumber(row.total, locale)}
                  </td>
                  <td className={`py-2.5 text-right text-sm ${color}`}>{row.percent}</td>
                  <td className={`py-2.5 text-right text-sm ${color}`}>{row.average}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {chips.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {chips.map((pull) => {
            const tone = featuredOutcomeTone(pull.wonFeatured, pull.wasGuaranteed);
            return (
              <span
                key={pull.id}
                className={`inline-flex items-center gap-2 rounded-full border bg-inset px-3 py-1.5 text-xs text-ink-2 ${CHIP_STYLE[tone]}`}
              >
                {pull.name}
                <span className={`font-mono text-xs font-medium ${CHIP_STYLE[tone]!.split(" ")[1]}`}>
                  {pull.pity}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

/** Baris tabel untuk banner karakter: 5★, menang 50/50, 4★, pecahan karakter/senjata. */
export function characterRows(stats: BannerStats, copy: ReturnType<typeof useCopy>["copy"]): SummaryRow[] {
  if (stats.totalPulls === 0) return [];

  return [
    {
      key: "five",
      label: copy.tables.fiveStar,
      total: stats.fiveStars.length,
      percent: formatPercent(stats.fiveStars.length, stats.totalPulls),
      average: formatAverage(averagePity(stats.fiveStars)),
      tone: "five",
      nested: false,
    },
    {
      key: "five-won",
      label: copy.tables.won5050,
      total: stats.fiveStarWins.length,
      // Penyebutnya adalah 5★ yang benar-benar ikut undian, bukan seluruh pull.
      percent: formatPercent(stats.fiveStarWins.length, stats.fiveStarRolls.length),
      average: "—",
      tone: "five",
      nested: true,
    },
    {
      key: "four",
      label: copy.tables.fourStar,
      total: stats.fourStars.length,
      percent: formatPercent(stats.fourStars.length, stats.totalPulls),
      average: formatAverage(averagePity(stats.fourStars)),
      tone: "four",
      nested: false,
    },
    {
      key: "four-char",
      label: copy.tables.fourStarCharacter,
      total: stats.fourStarCharacters.length,
      percent: formatPercent(stats.fourStarCharacters.length, stats.totalPulls),
      average: formatAverage(averagePity(stats.fourStarCharacters)),
      tone: "four",
      nested: true,
    },
    {
      key: "four-weapon",
      label: copy.tables.fourStarWeapon,
      total: stats.fourStarWeapons.length,
      percent: formatPercent(stats.fourStarWeapons.length, stats.totalPulls),
      average: formatAverage(averagePity(stats.fourStarWeapons)),
      tone: "four",
      nested: true,
    },
  ];
}

/** Baris tabel gabungan senjata + standar. */
export function weaponStandardRows(
  weapon: BannerStats,
  standard: BannerStats,
  copy: ReturnType<typeof useCopy>["copy"],
): SummaryRow[] {
  const rows: SummaryRow[] = [];

  if (weapon.totalPulls > 0) {
    rows.push(
      {
        key: "weapon-five",
        label: copy.tables.fiveStarWeapon,
        total: weapon.fiveStars.length,
        percent: formatPercent(weapon.fiveStars.length, weapon.totalPulls),
        average: formatAverage(averagePity(weapon.fiveStars)),
        tone: "five",
        nested: false,
      },
      {
        key: "weapon-rateup",
        label: copy.tables.gotRateUp,
        total: weapon.fiveStarWins.length,
        percent: formatPercent(weapon.fiveStarWins.length, weapon.fiveStarRolls.length),
        average: "—",
        tone: "five",
        nested: true,
      },
    );
  }

  if (standard.totalPulls > 0) {
    rows.push(
      {
        key: "standard-five",
        label: copy.tables.fiveStarStandard,
        total: standard.fiveStars.length,
        percent: formatPercent(standard.fiveStars.length, standard.totalPulls),
        average: formatAverage(averagePity(standard.fiveStars)),
        tone: "five",
        nested: false,
      },
      {
        key: "standard-four",
        label: copy.tables.fourStarStandard,
        total: standard.fourStars.length,
        percent: formatPercent(standard.fourStars.length, standard.totalPulls),
        average: formatAverage(averagePity(standard.fourStars)),
        tone: "four",
        nested: false,
      },
    );
  }

  return rows;
}

/** Beberapa 5★ terakhir, terbaru dulu — bahan chip di bawah tabel. */
export function recentChips(sources: BannerStats[], limit = 4): RankedPull[] {
  return sources
    .flatMap((stats) => stats.fiveStars)
    .sort((a, b) => (a.id.length !== b.id.length ? b.id.length - a.id.length : b.id.localeCompare(a.id)))
    .slice(0, limit);
}
