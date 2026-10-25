import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Which language tour content is shown in. Site chrome stays English. */
export type ContentLocale = 'en' | 'bn';

interface LocaleContextValue {
  locale: ContentLocale;
  setLocale: (locale: ContentLocale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'contentLanguage';

function getStoredLocale(): ContentLocale {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(STORAGE_KEY) === 'bn' ? 'bn' : 'en';
}

function applyLocale(locale: ContentLocale) {
  document.documentElement.lang = locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<ContentLocale>(getStoredLocale);

  const setLocale = useCallback((next: ContentLocale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyLocale(next);
  }, []);

  useEffect(() => {
    applyLocale(locale);

    // Keep other tabs on the same language when one of them switches.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setLocaleState(event.newValue === 'bn' ? 'bn' : 'en');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'bn' ? 'en' : 'bn');
  }, [locale, setLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggleLocale }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useContentLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useContentLocale must be used within LocaleProvider');
  return context;
}
