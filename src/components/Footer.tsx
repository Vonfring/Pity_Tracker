import { useCopy } from "../hooks/useCopy";

/** Satu baris. Brief melarang disclaimer panjang. */
export function Footer() {
  const { copy } = useCopy();

  return (
    <p className="mt-6 text-xs text-ink-faint">
      {copy.footer.retention} {copy.footer.notAffiliated}{" "}
      <a
        href="https://uigf.org"
        target="_blank"
        rel="noreferrer"
        className="text-gold hover:text-magenta"
      >
        {copy.footer.uigf}
      </a>
    </p>
  );
}
