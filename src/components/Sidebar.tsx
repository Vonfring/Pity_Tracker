import { LOCALES, LOCALE_LABEL, type Locale } from "../config/copy";
import { useCopy } from "../hooks/useCopy";

interface SidebarProps {
  uids: string[];
  activeUid: string | null;
  onSelectUid: (uid: string) => void;
}

/**
 * Sidebar ramping dengan satu entri nav — disengaja: produk ini memang satu layar.
 * Blok akun didorong ke bawah, jadi wordmark dan nav tetap di atas.
 */
export function Sidebar({ uids, activeUid, onSelectUid }: SidebarProps) {
  const { copy, locale, setLocale } = useCopy();

  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r border-line bg-sidebar px-4 py-[22px] md:flex md:w-[248px]">
      <span className="flex items-center gap-[11px] px-2 font-display text-[19px] leading-tight font-extrabold tracking-[-0.02em]">
        {/* Ikon dibentuk dari CSS, bukan aset resmi HoYoverse. */}
        <span
          aria-hidden
          className="grad-gold-magenta size-[22px] rotate-45 rounded-[7px]"
        />
        {copy.appName}
      </span>

      <nav className="mt-[26px] flex flex-col gap-1.5">
        <span className="grad-nav flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold shadow-[0_8px_24px_oklch(0.5_0.12_300/0.35)]">
          <span aria-hidden className="size-[9px] rotate-45 rounded-[3px] bg-gold" />
          {copy.nav.wishCounter}
        </span>
      </nav>

      <div className="flex-1" />

      <div className="space-y-4 border-t border-line pt-4">
        <div>
          <span className="block px-1.5 text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {copy.nav.account}
          </span>
          {uids.length > 0 ? (
            <select
              value={activeUid ?? ""}
              onChange={(event) => onSelectUid(event.target.value)}
              aria-label={copy.nav.selectAccount}
              className="mt-2 w-full rounded-[10px] border border-line-control bg-track px-2.5 py-[9px] text-sm text-ink-2 hover:border-magenta"
            >
              {uids.map((uid) => (
                <option key={uid} value={uid}>
                  {uid}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 rounded-[10px] border border-dashed border-line-button px-2.5 py-[9px] text-[13px] text-ink-muted">
              {copy.nav.noAccount}
            </p>
          )}
        </div>

        <div>
          <span className="block px-1.5 text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {copy.nav.language}
          </span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            aria-label={copy.nav.language}
            className="mt-2 w-full rounded-[10px] border border-line-control bg-track px-2.5 py-[9px] text-sm text-ink-2 hover:border-magenta"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABEL[code]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
