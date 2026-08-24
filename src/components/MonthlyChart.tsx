import { useMemo, useState } from "react";

import { useCopy } from "../hooks/useCopy";
import { formatNumber } from "../lib/recommendation";
import { busiestMonth, seriesTotal, type ChartSeries, type MonthlyPoint } from "../lib/stats";

interface MonthlyChartProps {
  points: MonthlyPoint[];
}

const SERIES: ChartSeries[] = ["character", "weapon", "standard"];

/**
 * Bar chart pull per bulan, seluruhnya CSS — tanpa library, tanpa SVG.
 * Tinggi batang dinormalisasi ke nilai tertinggi seri yang sedang tampil.
 */
export function MonthlyChart({ points }: MonthlyChartProps) {
  const { copy, locale } = useCopy();
  const [series, setSeries] = useState<ChartSeries>("character");

  const max = useMemo(
    () => points.reduce((best, point) => Math.max(best, point.counts[series]), 0),
    [points, series],
  );

  const total = seriesTotal(points, series);
  const busiest = busiestMonth(points, series);

  return (
    <article className="rounded-[18px] border border-line bg-card p-[18px]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[19px] font-semibold">{copy.chart.title}</h2>
        <span className="text-xs text-ink-muted">{copy.chart.lastMonths(points.length)}</span>
      </header>

      <div role="tablist" aria-label={copy.chart.title} className="mt-3.5 flex gap-2">
        {SERIES.map((key) => {
          const active = key === series;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSeries(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                active
                  ? "grad-nav border border-transparent text-ink"
                  : "border border-line-control bg-inset text-ink-muted hover:text-ink-2"
              }`}
            >
              {copy.chart.series[key]}
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] flex h-[190px] items-end gap-1.5 border-b border-line pb-0.5">
        {points.map((point) => {
          const value = point.counts[series];
          const height = max > 0 ? Math.max(2, (value / max) * 100) : 2;
          return (
            <span
              key={point.key}
              title={copy.chart.barTitle(point.label, formatNumber(value, locale))}
              className="relative flex h-full flex-1 flex-col justify-end overflow-hidden rounded-t-md"
            >
              <span
                aria-hidden
                className="grad-bar block rounded-t-md"
                style={{ height: `${height}%` }}
              />
            </span>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {points.map((point) => (
          <span
            key={point.key}
            className="flex-1 text-center font-mono text-[9px] text-ink-faint"
          >
            {point.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {busiest
          ? copy.chart.caption(
              formatNumber(total, locale),
              busiest.label,
              formatNumber(busiest.counts[series], locale),
            )
          : copy.chart.empty}
      </p>
    </article>
  );
}
