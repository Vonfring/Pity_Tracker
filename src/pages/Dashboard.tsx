import { useMemo, useState } from "react";

import { BannerCard } from "../components/BannerCard";
import { FirstRunPanel } from "../components/FirstRunPanel";
import { MonthlyChart } from "../components/MonthlyChart";
import {
  SummaryTable,
  characterRows,
  recentChips,
  weaponStandardRows,
} from "../components/SummaryTable";
import { DASHBOARD_BANNER_ORDER } from "../config/gacha";
import { useCopy } from "../hooks/useCopy";
import { computeBannerStats, monthlyPulls } from "../lib/stats";
import type { BannerPityState, UigfGachaType, WishRecord } from "../types/wish";

interface DashboardProps {
  pity: Record<UigfGachaType, BannerPityState>;
  records: WishRecord[];
  onGoImport: () => void;
  onCorrectGuaranteed: (bannerId: UigfGachaType, value: boolean) => void;
}

/**
 * Wish Counter — seluruh banner tampil sekaligus dalam grid.
 * Tidak ada tab, tidak ada klik yang diperlukan untuk membandingkan pity.
 */
export function Dashboard({ pity, records, onGoImport, onCorrectGuaranteed }: DashboardProps) {
  const { copy } = useCopy();
  const [open, setOpen] = useState<Record<string, boolean>>({ "301": true });

  const firstRun = records.length === 0;

  const stats = useMemo(
    () => ({
      character: computeBannerStats(records, "301"),
      weapon: computeBannerStats(records, "302"),
      standard: computeBannerStats(records, "200"),
    }),
    [records],
  );

  const months = useMemo(() => monthlyPulls(records), [records]);
  const charRows = characterRows(stats.character, copy);
  const wsRows = weaponStandardRows(stats.weapon, stats.standard, copy);

  return (
    <>
      {firstRun ? <FirstRunPanel onGoImport={onGoImport} /> : null}

      {/* 3 kolom di layar lebar, 2 di menengah, 1 di sempit. */}
      <section className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(330px,1fr))] gap-4">
        {DASHBOARD_BANNER_ORDER.map((bannerId) => {
          const state = pity[bannerId];
          if (!state) return null;
          return (
            <BannerCard
              key={bannerId}
              state={state}
              open={!!open[bannerId] && state.totalPulls > 0}
              onToggle={(id) => setOpen((current) => ({ ...current, [id]: !current[id] }))}
              onCorrectGuaranteed={onCorrectGuaranteed}
            />
          );
        })}

        {!firstRun && months.length > 0 ? <MonthlyChart points={months} /> : null}
      </section>

      {!firstRun && (charRows.length > 0 || wsRows.length > 0) ? (
        <section className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(330px,1fr))] gap-4">
          {charRows.length > 0 ? (
            <SummaryTable
              title={copy.tables.characterEvent}
              rows={charRows}
              chips={recentChips([stats.character])}
            />
          ) : null}
          {wsRows.length > 0 ? (
            <SummaryTable
              title={copy.tables.weaponStandard}
              rows={wsRows}
              chips={recentChips([stats.weapon, stats.standard])}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );
}
