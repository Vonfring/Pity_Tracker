import { useId, useState, type ReactNode } from "react";

import { useCopy } from "../hooks/useCopy";

interface TooltipProps {
  /** Kunci di glossary. Kalau tidak ada isinya, anak-anaknya dirender apa adanya. */
  term?: string;
  text?: string;
  children: ReactNode;
}

/**
 * Penjelasan istilah gacha.
 *
 * Muncul saat hover (ini desktop, pengguna punya kursor) DAN saat fokus
 * keyboard — tanpa yang kedua, pemakai keyboard tidak akan pernah melihatnya.
 */
export function Tooltip({ term, text, children }: TooltipProps) {
  const { copy } = useCopy();
  const [open, setOpen] = useState(false);
  const id = useId();
  const body = text ?? (term ? copy.glossary[term.toLowerCase()] : undefined);

  if (!body) return <>{children}</>;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        className="cursor-help border-b border-dotted border-ink-faint text-left"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-line bg-inset p-3 text-xs leading-relaxed font-normal text-ink shadow-xl"
        >
          {body}
        </span>
      ) : null}
    </span>
  );
}
