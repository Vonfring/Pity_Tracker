import { chanceWithin, getBannerConfig } from "../lib/pity";
import {
  formatChance,
  formatNumber,
  formatPrimogems,
  getFeaturedNote,
  getRecommendation,
} from "../lib/recommendation";
import { useCopy } from "../hooks/useCopy";
import type { BannerPityState, UigfGachaType } from "../types/wish";
import { Tooltip } from "./Tooltip";

interface BannerCardProps {
  state: BannerPityState;
  open: boolean;
  onToggle: (bannerId: UigfGachaType) => void;
  onCorrectGuaranteed: (bannerId: UigfGachaType, value: boolean) => void;
}

/** Berapa pull ke depan yang ditampilkan di panel detail. */
const HORIZONS = [10, 30, 50];

/** Warna pill tag per banner. */
const TAG_STYLE: Record<string, string> = {
  "301": "bg-[oklch(0.32_0.07_88)] text-gold",
  "302": "bg-[oklch(0.32_0.07_330)] text-[oklch(0.85_0.12_330)]",
};
const TAG_DEFAULT = "bg-[oklch(0.28_0.03_285)] text-ink-muted";

/** Gradien progress bar per banner. */
const BAR_GRADIENT: Record<string, string> = {
  "301": "linear-gradient(90deg, oklch(0.87 0.14 88), oklch(0.79 0.14 55))",
  "302": "linear-gradient(90deg, oklch(0.78 0.15 330), oklch(0.87 0.14 88))",
  "200": "linear-gradient(90deg, oklch(0.72 0.13 235), oklch(0.78 0.15 320))",
  "500": "linear-gradient(90deg, oklch(0.78 0.13 200), oklch(0.72 0.13 240))",
};

const TONE_CLASS: Record<string, string> = {
  pull: "text-gold",
  hold: "text-ink-3",
  neutral: "text-ink-muted",
};

export function BannerCard({ state, open, onToggle, onCorrectGuaranteed }: BannerCardProps) {
  const { copy, locale } = useCopy();
  const banner = getBannerConfig(state.bannerId);
  const recommendation = getRecommendation(state, copy);
  const hasPulls = state.totalPulls > 0;
  const name = copy.banner.names[state.bannerId] ?? state.bannerId;
  const fill = Math.min(100, (state.pity / state.hardPity) * 100);

  return (
    <article className="rounded-[18px] border border-line bg-card p-[18px]">
      <header className="flex items-center justify-between gap-2.5">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{name}</h2>
        <span
          className={`rounded-full px-[11px] py-[5px] text-[11px] font-semibold tracking-[0.03em] ${
            TAG_STYLE[state.bannerId] ?? TAG_DEFAULT
          }`}
        >
          {copy.banner.tags[state.bannerId] ?? ""}
        </span>
      </header>

      <StatRow
        stat="pulls"
        className="mt-3.5"
        label={copy.banner.lifetimePulls}
        sub={
          <span className="mt-[3px] flex items-center gap-1.5 font-mono text-xs text-ink-muted">
            <span aria-hidden className="size-[7px] rotate-45 rounded-[2px] bg-cyan" />
            {formatPrimogems(state.totalPulls, locale)}
          </span>
        }
        value={formatNumber(state.totalPulls, locale)}
      />

      <StatRow
        stat="pity5"
        className="mt-2.5"
        label={<Tooltip term="pity">{copy.banner.pity5}</Tooltip>}
        sub={
          <span className="mt-[3px] block text-xs text-ink-muted">
            {copy.banner.guaranteedAt(state.hardPity)}
          </span>
        }
        value={String(state.pity)}
        valueClass={state.isSoftPity ? "text-gold" : "text-ink"}
      />

      <StatRow
        stat="pity4"
        className="mt-2.5"
        label={copy.banner.pity4}
        sub={<span className="mt-[3px] block text-xs text-ink-muted">{copy.banner.guaranteedAt4}</span>}
        value={String(state.pity4)}
        valueClass="text-purple"
      />

      <div
        className="mt-3.5 h-2 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={state.hardPity}
        aria-valuenow={state.pity}
        aria-label={`${copy.banner.pity5} ${state.pity} / ${state.hardPity}`}
      >
        <span
          aria-hidden
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${fill}%`, backgroundImage: BAR_GRADIENT[state.bannerId] }}
        />
      </div>

      <p className={`mt-2.5 text-[13px] leading-[1.55] ${TONE_CLASS[recommendation.tone]}`}>
        {recommendation.text}
      </p>

      {banner.guaranteeAfterLoss && hasPulls ? (
        <button
          type="button"
          onClick={() => onCorrectGuaranteed(state.bannerId, !state.guaranteed)}
          title={copy.banner.correctHint}
          className="mt-2 text-[11px] font-medium text-ink-faint hover:text-ink"
        >
          {copy.banner.correct}
        </button>
      ) : null}

      {/* Kontrol mati tidak pernah dirender — kartu kosong tidak punya detail. */}
      {hasPulls ? (
        <>
          <button
            type="button"
            onClick={() => onToggle(state.bannerId)}
            aria-expanded={open}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-[9px] text-[13px] font-medium text-ink-3 hover:border-magenta hover:text-white"
          >
            {open ? copy.banner.hideDetails : copy.banner.seeOdds}
          </button>

          {open ? <DetailPanel state={state} /> : null}
        </>
      ) : null}
    </article>
  );
}

function StatRow({
  stat,
  label,
  sub,
  value,
  valueClass = "text-ink",
  className = "",
}: {
  /** Penanda stabil untuk baris ini — angkanya bisa kembar antar baris. */
  stat: string;
  label: React.ReactNode;
  sub: React.ReactNode;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div
      data-stat={stat}
      className={`flex items-center justify-between gap-3 rounded-[14px] bg-inset px-4 py-3.5 ${className}`}
    >
      <span>
        <span className="block text-sm font-medium text-ink-2">{label}</span>
        {sub}
      </span>
      <span
        data-stat-value=""
        className={`tnum font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailPanel({ state }: { state: BannerPityState }) {
  const { copy, locale } = useCopy();
  const banner = getBannerConfig(state.bannerId);

  const rows = HORIZONS.map((pulls) => {
    const chance = chanceWithin(state.pity, pulls, banner);
    return {
      key: String(pulls),
      label: copy.banner.morePulls(pulls),
      chance: formatChance(chance),
      chanceClass: chance >= 0.6 ? "text-gold" : "text-ink",
      cost: formatPrimogems(pulls, locale),
    };
  });

  return (
    <div className="mt-3 rounded-[14px] border border-line bg-inset px-3.5 py-3">
      {rows.map(({ key, ...row }) => (
        <Row key={key} {...row} />
      ))}
      <Row
        label={copy.banner.untilGuaranteed(state.pullsToHardPity)}
        chance="100%"
        chanceClass="text-purple"
        cost={formatPrimogems(state.pullsToHardPity, locale)}
      />
      <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
        {getFeaturedNote(state, copy)}
      </p>
    </div>
  );
}

function Row({
  label,
  chance,
  chanceClass,
  cost,
}: {
  label: string;
  chance: string;
  chanceClass: string;
  cost: string;
}) {
  const { copy } = useCopy();
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-track py-2 last:border-0">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="flex items-baseline gap-2.5">
        <span className={`tnum text-[15px] font-semibold ${chanceClass}`}>{chance}</span>
        <span className="font-mono text-[11px] text-ink-faint">
          {cost} {copy.banner.primo}
        </span>
      </span>
    </div>
  );
}
