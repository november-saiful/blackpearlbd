import { useEffect, useState, useMemo } from 'react';

type GeoData = {
  /** ISO 3166-1 alpha-2 country code, e.g. "BD", "US" */
  country: string;
  /** IANA timezone, e.g. "Asia/Dhaka", "America/New_York" */
  timezone: string;
  /** ISO 4217 currency code, e.g. "BDT", "USD" */
  currency: string;
  /** Locale string for Intl formatting, e.g. "en-BD", "en-US" */
  locale: string;
  /** Whether geolocation has finished loading */
  loaded: boolean;
};

const STORAGE_KEY = 'geo-location';

// ── Module-level geo state ───────────────────────────────────────────
// Updated by useGeoLocation so formatCurrency (a plain utility, not a
// hook) can read the geo-detected currency & locale without React context.
let _geoCurrency = 'BDT';
let _geoLocale = 'en-BD';

/** Return the geo-detected ISO 4217 currency code (default: USD). */
export function getGeoCurrency(): string { return _geoCurrency; }
/** Return the geo-detected locale string (default: en-US). */
export function getGeoLocale(): string { return _geoLocale; }

const CURRENCY_MAP: Record<string, { currency: string; locale: string }> = {
  BD: { currency: 'BDT', locale: 'bn-BD' },
  IN: { currency: 'INR', locale: 'en-IN' },
  US: { currency: 'USD', locale: 'en-US' },
  GB: { currency: 'GBP', locale: 'en-GB' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  FR: { currency: 'EUR', locale: 'fr-FR' },
  JP: { currency: 'JPY', locale: 'ja-JP' },
  AU: { currency: 'AUD', locale: 'en-AU' },
  CA: { currency: 'CAD', locale: 'en-CA' },
  SG: { currency: 'SGD', locale: 'en-SG' },
  MY: { currency: 'MYR', locale: 'ms-MY' },
  TH: { currency: 'THB', locale: 'th-TH' },
  AE: { currency: 'AED', locale: 'ar-AE' },
  SA: { currency: 'SAR', locale: 'ar-SA' },
  NP: { currency: 'NPR', locale: 'ne-NP' },
  LK: { currency: 'LKR', locale: 'si-LK' },
  PK: { currency: 'PKR', locale: 'en-PK' },
};

/** Get a valid IANA timezone, falling back to UTC */
function resolveTimezone(tz?: string): string {
  if (!tz) return 'UTC';
  try {
    // Verify the timezone is recognized by the runtime
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Resolve country → currency + locale with a sensible fallback */
function resolveCountry(code?: string): { currency: string; locale: string; country: string } {
  const c = code?.toUpperCase();
  const mapped = c ? CURRENCY_MAP[c] : undefined;
  return {
    country: c ?? 'BD',
    currency: mapped?.currency ?? 'BDT',
    locale: mapped?.locale ?? 'en-BD',
  };
}

function loadCached(): GeoData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...JSON.parse(raw), loaded: true };
  } catch {
    return null;
  }
}

function saveCached(data: Omit<GeoData, 'loaded'>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded, ignore
  }
}

/**
 * Detects the visitor's country, timezone, and currency from their IP address.
 *
 * - Fetches once on mount via the free ip-api.com endpoint (no key needed).
 * - Caches the result in sessionStorage so subsequent visits are instant.
 * - Falls back to UTC / USD / en-US if the API fails or is blocked.
 */
export function useGeoLocation(): GeoData {
  const cached = useMemo(() => loadCached(), []);
  const [geo, setGeo] = useState<GeoData>(
    (() => {
      if (cached) {
        _geoCurrency = cached.currency;
        _geoLocale = cached.locale;
      }
      return cached ?? {
        country: 'BD',
        timezone: 'UTC',
        currency: 'BDT',
        locale: 'en-BD',
        loaded: false,
      };
    })(),
  );

  useEffect(() => {
    // Already have data from cache
    if (cached) return;

    let cancelled = false;

    async function fetchGeo() {
      try {
        const res = await fetch('https://ip-api.com/json/?fields=countryCode,timeZone');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        const tz = resolveTimezone(data.timeZone);
        const { country, currency, locale } = resolveCountry(data.countryCode);

        const result: Omit<GeoData, 'loaded'> = { country, timezone: tz, currency, locale };
        saveCached(result);
        _geoCurrency = currency;
        _geoLocale = locale;
        setGeo({ ...result, loaded: true });
      } catch {
        if (!cancelled) {
          // Use browser's own timezone detection as a last resort
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
          _geoCurrency = 'BDT';
          _geoLocale = 'en-BD';
          const result: Omit<GeoData, 'loaded'> = {
            country: 'BD',
            timezone: tz,
            currency: 'BDT',
            locale: 'en-BD',
          };
          setGeo({ ...result, loaded: true });
        }
      }
    }

    fetchGeo();
    return () => { cancelled = true; };
  }, [cached]);

  return geo;
}

/**
 * Format a date in the visitor's local timezone.
 * Returns the formatted string, e.g. "August 25, 2026 (GMT+6)"
 */
export function formatDateInTimezone(
  month: string,
  day: string,
  year: string,
  timezone: string,
): string {
  const m = MONTHS.find((mo) => mo.value === month);
  const monthName = m?.label ?? month;

  try {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const dateStr = parts
      .filter((p) => p.type !== 'timeZoneName')
      .map((p) => p.value)
      .join('')
      .trim();

    return dateStr;
  } catch {
    // Fallback if timezone formatting fails
    return `${monthName} ${parseInt(day)}, ${year}`;
  }
}

const MONTHS = [
  { label: 'January', value: '01' },
  { label: 'February', value: '02' },
  { label: 'March', value: '03' },
  { label: 'April', value: '04' },
  { label: 'May', value: '05' },
  { label: 'June', value: '06' },
  { label: 'July', value: '07' },
  { label: 'August', value: '08' },
  { label: 'September', value: '09' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];
