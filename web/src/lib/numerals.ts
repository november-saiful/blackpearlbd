/**
 * Mirrors `ContentLocale` from `@/lib/locale`, declared here so this module
 * stays dependency-free: the Functions bundle imports it through `duration.ts`
 * and cannot resolve the `@/` alias (or React, which `locale.tsx` pulls in).
 */
export type NumberLocale = 'en' | 'bn';

/**
 * Numbers in the reader's own script.
 *
 * The site shows tour content in English or Bengali, but `Intl` only knows the
 * language of the locale it is handed — and the currency formatter was handing
 * it the *visitor's* locale (geo-detected, `en-US` for most people), so a
 * Bengali page still printed `BDT 4,800`. These helpers take the content
 * language explicitly, which is the only thing that decides the script.
 *
 * Bengali groups numbers the lakh/crore way (১,৫০,০০০), so the grouping comes
 * from `Intl` rather than being reimplemented; only the digits are converted by
 * hand, for strings that are built around a number.
 */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Latin digits to Bengali ones; the rest of the string is left alone. */
export function toBengaliDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)]);
}

/** A whole number with the language's digits and grouping. */
export function formatNumber(value: number, locale: NumberLocale): string {
  const formatted = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
  // `Intl` renders bn-BD in Bengali digits already, but a runtime with trimmed
  // ICU data can fall back to Latin ones, so the conversion is belt and braces.
  return locale === 'bn' ? toBengaliDigits(formatted) : formatted;
}

/** A rating like `4.8`, keeping one decimal in either language. */
export function formatRating(value: number, locale: NumberLocale): string {
  const formatted = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return locale === 'bn' ? toBengaliDigits(formatted) : formatted;
}

/**
 * `4,800 টাকা` in Bengali. The currency word follows the money rather than
 * leading it, and only the taka gets a Bengali word — anything else keeps its
 * code so a foreign price is never mislabelled.
 */
export function formatBengaliPrice(amount: number, currencyCode: string): string {
  const code = currencyCode.trim().toUpperCase();
  return `${formatNumber(amount, 'bn')} ${code === 'BDT' ? 'টাকা' : code}`;
}
