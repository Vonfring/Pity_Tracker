/**
 * Bahasa aktif dan teksnya.
 *
 * Tanpa provider, hook ini mengembalikan bahasa default (Inggris) — jadi
 * komponen bisa dirender sendirian di test tanpa perlu dibungkus apa pun.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LOCALES,
  getCopy,
  type Copy,
  type Locale,
} from "../config/copy";
import { getLocale as readStoredLocale, setLocale as storeLocale } from "../lib/prefs";

interface LocaleValue {
  locale: Locale;
  copy: Copy;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleValue | null>(null);

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

/** Bahasa yang tersimpan dari kunjungan sebelumnya, kalau ada. */
function initialLocale(): Locale {
  const stored = readStoredLocale();
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Dipakai test untuk memaksa satu bahasa tanpa menyentuh localStorage. */
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? initialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  // Atribut lang ikut berubah supaya pembaca layar melafalkan bahasa yang benar.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleValue>(
    () => ({ locale, copy: getCopy(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const FALLBACK: LocaleValue = {
  locale: DEFAULT_LOCALE,
  copy: getCopy(DEFAULT_LOCALE),
  setLocale: () => {},
};

export function useCopy(): LocaleValue {
  return useContext(LocaleContext) ?? FALLBACK;
}
