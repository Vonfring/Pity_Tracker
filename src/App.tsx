import { useCallback, useEffect, useState } from "react";

import { Footer } from "./components/Footer";
import { Sidebar } from "./components/Sidebar";
import { LocaleProvider, useCopy } from "./hooks/useCopy";
import { useWishData } from "./hooks/useWishData";
import { formatNumber, formatRelativeTime } from "./lib/recommendation";
import { buildUigfDocument, serializeUigf, suggestExportFilename } from "./lib/uigf";
import { Dashboard } from "./pages/Dashboard";
import { ImportPage } from "./pages/ImportPage";
import type { UigfGachaType } from "./types/wish";

type Page = "counter" | "import";

const APP_VERSION = "0.1.0";

/**
 * Hanya dua halaman, jadi router-nya cukup hash sederhana — tanpa library,
 * dan tanpa sidebar navigasi bercabang.
 */
function readPage(): Page {
  return globalThis.location?.hash === "#import" ? "import" : "counter";
}

export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

function Shell() {
  const { copy, locale } = useCopy();
  const data = useWishData();
  const [page, setPage] = useState<Page>(readPage);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const sync = () => setPage(readPage());
    globalThis.addEventListener?.("hashchange", sync);
    return () => globalThis.removeEventListener?.("hashchange", sync);
  }, []);

  const goto = useCallback((next: Page) => {
    setPage(next);
    if (globalThis.location) globalThis.location.hash = next === "import" ? "#import" : "";
  }, []);

  const goImport = useCallback(() => goto("import"), [goto]);
  const goCounter = useCallback(() => {
    data.resetImportState();
    goto("counter");
  }, [goto, data]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const accounts = await data.exportAll();
      if (accounts.length === 0) return;

      const doc = buildUigfDocument(
        accounts.map((account) => ({
          uid: account.meta.uid,
          records: account.records,
          ...(account.meta.timezone !== null ? { timezone: account.meta.timezone } : {}),
          ...(account.meta.lang ? { lang: account.meta.lang } : {}),
        })),
        { appVersion: APP_VERSION, exportTimestamp: Math.floor(Date.now() / 1000) },
      );

      downloadJson(
        serializeUigf(doc),
        suggestExportFilename(data.activeUid ?? accounts[0]!.meta.uid, todayStamp()),
      );
    } finally {
      setExporting(false);
    }
  }, [data]);

  const handleCorrectGuaranteed = useCallback(
    (bannerId: UigfGachaType, value: boolean) => {
      void data.setGuaranteedOverride(bannerId, value);
    },
    [data],
  );

  const totalPulls = data.records.length;
  const meta =
    totalPulls === 0 || !data.meta.lastImportAt
      ? copy.header.nothingImported
      : copy.header.meta(
          formatRelativeTime(data.meta.lastImportAt, copy),
          formatNumber(totalPulls, locale),
        );

  return (
    <div className="grid min-h-screen md:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar uids={data.uids} activeUid={data.activeUid} onSelectUid={data.selectUid} />

      <main className="min-w-0 px-6 pt-[26px] pb-12 md:px-[30px]">
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="font-display text-[38px] leading-[1.05] font-extrabold tracking-[-0.035em]">
            {copy.header.title}
          </h1>

          <button
            type="button"
            onClick={goImport}
            className="grad-gold flex items-center gap-2.5 rounded-xl px-[18px] py-2.5 text-sm font-semibold text-[oklch(0.2_0.04_80)] hover:brightness-[1.07]"
          >
            <span aria-hidden className="size-2 rotate-45 rounded-[2px] bg-[oklch(0.2_0.04_80)]" />
            {copy.header.autoImport}
          </button>

          <button
            type="button"
            onClick={goImport}
            className="rounded-xl border border-line-button bg-track px-[18px] py-2.5 text-sm font-medium text-ink-2 hover:border-magenta"
          >
            {copy.header.importFile}
          </button>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={data.uids.length === 0 || exporting}
            className="rounded-xl border border-line-button px-[18px] py-2.5 text-sm font-medium text-ink-muted hover:border-magenta hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export
          </button>

          <div className="flex-1" />
          <span className="text-[13px] text-ink-muted">{meta}</span>
        </div>

        {!data.ready ? (
          <p className="mt-10 text-sm text-ink-faint">{copy.header.loading}</p>
        ) : page === "import" ? (
          <ImportPage
            importState={data.importState}
            onImportUrl={data.importFromUrl}
            onImportFile={data.importFromUigfText}
            onCancel={data.cancelImport}
            onDone={goCounter}
            onBack={goCounter}
            onReset={data.resetImportState}
          />
        ) : (
          <>
            <Dashboard
              pity={data.pity}
              records={data.records}
              onGoImport={goImport}
              onCorrectGuaranteed={handleCorrectGuaranteed}
            />
            <Footer />
          </>
        )}
      </main>
    </div>
  );
}

function todayStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Unduh string sebagai file, tanpa menyentuh server mana pun. */
function downloadJson(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
