import { useRef, useState } from "react";

import powershellScript from "../config/get-wish-url.ps1?raw";
import { useCopy } from "../hooks/useCopy";
import { formatNumber } from "../lib/recommendation";
import type { ImportState } from "../hooks/useWishData";

interface ImportPageProps {
  importState: ImportState;
  onImportUrl: (url: string) => Promise<boolean>;
  onImportFile: (text: string) => Promise<boolean>;
  onCancel: () => void;
  onDone: () => void;
  onReset: () => void;
  onBack: () => void;
}

type Tab = "windows" | "file";

export function ImportPage({
  importState,
  onImportUrl,
  onImportFile,
  onCancel,
  onDone,
  onReset,
  onBack,
}: ImportPageProps) {
  const { copy } = useCopy();
  const [tab, setTab] = useState<Tab>("windows");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const running = importState.phase === "running";

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(powershellScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard ditolak browser — biarkan, pengguna masih bisa blok-salin manual.
    }
  }

  async function submitUrl(event: React.FormEvent) {
    event.preventDefault();
    const success = await onImportUrl(url);
    if (success) setUrl("");
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await onImportFile(await file.text());
    event.target.value = "";
  }

  return (
    <section className="mt-[22px] grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <article className="rounded-[18px] border border-line bg-card p-[22px]">
        <header className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
            {copy.import.title}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="rounded-[10px] border border-line-button bg-inset px-3.5 py-2 text-[13px] text-ink-2 hover:border-magenta hover:text-white"
          >
            {copy.import.back}
          </button>
        </header>

        <p className="mt-2.5 max-w-[62ch] text-sm leading-[1.7] text-ink-3">{copy.import.intro}</p>

        <div role="tablist" aria-label={copy.import.title} className="mt-[18px] flex gap-1.5 border-b border-line">
          <TabButton active={tab === "windows"} onClick={() => setTab("windows")}>
            {copy.import.tabWindows}
          </TabButton>
          <TabButton active={tab === "file"} onClick={() => setTab("file")}>
            {copy.import.tabFile}
          </TabButton>
        </div>

        {tab === "windows" ? (
          <WindowsGuide script={powershellScript} copied={copied} onCopy={copyScript} />
        ) : (
          <FileGuide onPick={() => fileInput.current?.click()} />
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="sr-only"
          aria-label={copy.import.chooseFile}
        />
      </article>

      <div className="grid gap-4">
        <form onSubmit={submitUrl} className="rounded-[18px] border border-line bg-card p-[22px]">
          <h2 className="font-display text-[17px] font-semibold">{copy.import.pasteTitle}</h2>
          <p className="mt-1.5 text-xs leading-[1.6] text-ink-muted">{copy.import.pasteHint}</p>

          <textarea
            id="wish-url"
            aria-label={copy.import.pasteLabel}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={running}
            rows={5}
            spellCheck={false}
            placeholder={copy.import.pastePlaceholder}
            className="mt-3 w-full resize-y rounded-xl border border-line-control bg-well p-3 font-mono text-xs leading-[1.6] break-all text-ink-2 placeholder:text-ink-faint/60 disabled:opacity-50"
          />

          <div className="mt-3 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={running || url.trim().length === 0}
              className="grad-gold rounded-xl px-5 py-2.5 text-sm font-semibold text-[oklch(0.2_0.04_80)] hover:brightness-[1.07] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? copy.import.pulling : copy.import.pull}
            </button>
            {running ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-line-button px-4 py-2.5 text-sm text-ink-3 hover:text-white"
              >
                {copy.import.cancel}
              </button>
            ) : null}
          </div>

          <ImportStatus state={importState} onDone={onDone} onReset={onReset} />
        </form>

        <PrivacyCard />
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold ${
        active ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink-3"
      }`}
    >
      {children}
    </button>
  );
}

function WindowsGuide({
  script,
  copied,
  onCopy,
}: {
  script: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { copy } = useCopy();

  return (
    <div>
      <ol className="mt-[22px] flex list-none flex-col gap-[18px] p-0">
        {copy.import.steps.map((step, index) => (
          <li key={step.title} className="flex gap-3.5">
            <span
              aria-hidden
              className="grad-gold-magenta flex size-[30px] shrink-0 items-center justify-center rounded-[10px] font-display text-sm font-extrabold text-[oklch(0.2_0.04_80)]"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mt-1 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-[1.7] text-ink-3">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 overflow-hidden rounded-[14px] border border-line bg-well">
        <div className="flex items-center justify-between gap-2.5 border-b border-line px-3.5 py-2.5">
          <span className="font-mono text-[11px] text-ink-muted">get-wish-url.ps1</span>
          <button
            type="button"
            onClick={onCopy}
            className="grad-gold rounded-full px-3.5 py-1.5 text-xs font-semibold text-[oklch(0.2_0.04_80)] hover:brightness-[1.07]"
          >
            {copied ? copy.import.copied : copy.import.copy}
          </button>
        </div>
        <pre className="max-h-[230px] overflow-auto p-3.5 font-mono text-[11px] leading-[1.75] text-ink-3">
          <code>{script}</code>
        </pre>
      </div>
      <p className="mt-2.5 text-xs text-ink-faint">{copy.import.scriptCaption}</p>

      <WhatItDoes />
      <Troubleshooting />
    </div>
  );
}

function WhatItDoes() {
  const { copy } = useCopy();

  return (
    <div className="mt-6 rounded-[14px] border border-line bg-inset p-[18px]">
      <h3 className="text-[15px] font-semibold">{copy.import.whatItDoesTitle}</h3>
      <p className="mt-2 text-sm leading-[1.7] text-ink-3">{copy.import.whatItDoesIntro}</p>
      <ul className="mt-3 space-y-2 text-sm text-ink-3">
        {copy.import.whatItDoes.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-faint" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-[1.7] text-ink-3">{copy.import.whatItDoesNot}</p>
    </div>
  );
}

function Troubleshooting() {
  const { copy } = useCopy();

  return (
    <div className="mt-6">
      <h3 className="text-[15px] font-semibold">{copy.import.troubleTitle}</h3>
      <div className="mt-2.5 rounded-[14px] border border-line bg-inset">
        {copy.import.troubles.map((item) => (
          <details key={item.q} className="group border-b border-track px-4 py-3.5 last:border-0">
            <summary className="flex cursor-pointer list-none gap-2.5 text-sm text-ink-2 marker:content-none hover:text-ink">
              <span aria-hidden className="text-gold transition-transform group-open:rotate-45">
                +
              </span>
              {item.q}
            </summary>
            <p className="mt-2 pl-5 text-[13px] leading-[1.7] text-ink-3">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function FileGuide({ onPick }: { onPick: () => void }) {
  const { copy } = useCopy();

  return (
    <div className="mt-[22px] rounded-[14px] border border-dashed border-line-button bg-inset p-[26px] text-center">
      <h3 className="text-base font-semibold">{copy.import.notWindowsTitle}</h3>
      <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-[1.7] text-ink-3">
        {copy.import.notWindowsBody}
      </p>
      <button
        type="button"
        onClick={onPick}
        className="grad-gold-magenta mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-[oklch(0.2_0.04_80)] hover:brightness-[1.07]"
      >
        {copy.import.chooseFile}
      </button>
    </div>
  );
}

function ImportStatus({
  state,
  onDone,
  onReset,
}: {
  state: ImportState;
  onDone: () => void;
  onReset: () => void;
}) {
  const { copy, locale } = useCopy();

  if (state.phase === "running") {
    const progress = state.progress;
    const percent = progress ? (progress.bannerIndex / Math.max(1, progress.bannerTotal)) * 100 : 0;

    return (
      <div className="mt-4" aria-live="polite">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <span
            className="grad-progress block h-full rounded-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2.5 text-[13px] text-ink-3">
          {progress?.throttled
            ? copy.import.throttled
            : copy.import.progress(
                progress?.bannerName ?? "",
                formatNumber(progress?.fetched ?? 0, locale),
              )}
        </p>
        <p className="mt-1 text-xs text-ink-faint">{copy.import.keepOpen}</p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div
        className="mt-4 rounded-xl border border-red/45 bg-red/12 p-3.5"
        role="alert"
      >
        <p className="text-sm leading-relaxed text-ink">{state.errorMessage}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-2 text-[13px] font-semibold text-gold hover:underline"
        >
          {copy.import.tryAgain}
        </button>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div
        className="mt-4 rounded-xl border border-green/45 bg-green/12 p-3.5"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-green">
          {state.added && state.added > 0
            ? copy.import.doneWithNew(formatNumber(state.added, locale))
            : copy.import.doneNothingNew}
        </p>
        <p className="mt-1.5 text-xs leading-[1.6] text-ink-3">{copy.import.doneNote}</p>
        {state.warnings.map((warning) => (
          <p key={warning} className="mt-1.5 text-xs text-ink-3">
            {warning}
          </p>
        ))}
        <button
          type="button"
          onClick={onDone}
          className="mt-2 text-[13px] font-semibold text-gold hover:underline"
        >
          {copy.import.seeCounter}
        </button>
      </div>
    );
  }

  return null;
}

function PrivacyCard() {
  const { copy } = useCopy();

  return (
    <article className="rounded-[18px] border border-line bg-card p-[22px]">
      <h2 className="font-display text-[17px] font-semibold">{copy.privacy.title}</h2>
      {copy.privacy.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-[1.7] text-ink-3 first:mt-2">
          {paragraph}
        </p>
      ))}
    </article>
  );
}
