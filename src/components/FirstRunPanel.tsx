import { useCopy } from "../hooks/useCopy";

interface FirstRunPanelProps {
  onGoImport: () => void;
}

/**
 * Panel onboarding — hal pertama yang dilihat pengguna baru.
 * Tugasnya cuma satu: mengarahkan ke halaman import tanpa terasa memaksa.
 */
export function FirstRunPanel({ onGoImport }: FirstRunPanelProps) {
  const { copy } = useCopy();

  return (
    <article className="grad-onboard relative mt-[22px] overflow-hidden rounded-[18px] border border-[oklch(0.36_0.04_300)] p-[26px]">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[140px] -right-20 h-[320px] w-[420px] rounded-full bg-[radial-gradient(circle,oklch(0.87_0.14_88/0.18),transparent_65%)]"
      />

      <div className="relative flex flex-wrap items-center gap-[26px]">
        <div className="min-w-[280px] flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.4_0.04_300)] bg-sidebar/70 px-3.5 py-1.5 text-xs text-ink-3">
            <span aria-hidden className="size-[7px] rounded-full bg-green" />
            {copy.firstRun.pill}
          </span>

          <h2 className="mt-3.5 font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.03em] text-balance">
            {copy.firstRun.heading}
          </h2>
          <p className="mt-2.5 max-w-[60ch] text-[15px] leading-[1.7] text-ink-3">
            {copy.firstRun.body}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onGoImport}
              className="grad-gold rounded-xl px-[22px] py-3 text-sm font-semibold text-[oklch(0.2_0.04_80)] hover:brightness-[1.07]"
            >
              {copy.firstRun.primary}
            </button>
            <button
              type="button"
              onClick={onGoImport}
              className="rounded-xl border border-[oklch(0.4_0.03_290)] bg-sidebar px-5 py-3 text-sm font-medium text-ink-2 hover:border-magenta"
            >
              {copy.firstRun.secondary}
            </button>
          </div>
        </div>

        <ul className="grid flex-[0_1_300px] gap-2.5">
          {copy.firstRun.notes.map((note) => (
            <li
              key={note}
              className="flex gap-2.5 rounded-xl border border-line-control bg-inset px-3.5 py-3 text-[13px] leading-[1.6] text-ink-3"
            >
              <span aria-hidden className="mt-1.5 size-[7px] shrink-0 rotate-45 rounded-[2px] bg-gold" />
              {note}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
