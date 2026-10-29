import { toBengaliDigits, type NumberLocale } from './numerals';

/**
 * How long a tour runs, as copy the whole app can share.
 *
 * Nights are derived from days (a 3-day tour spends 2 of them away from home)
 * instead of being stored: the admin form only asks for days, and a stored
 * copy could drift out of step with it the first time someone edits one field
 * and forgets the other. Surfaces that need the number itself call
 * {@link tourNights} and write their own wording around it.
 */
export function tourNights(days: number | null | undefined): number {
  if (typeof days !== 'number' || !Number.isFinite(days)) return 0;
  return Math.max(Math.floor(days) - 1, 0);
}

function unset(days: number | null | undefined): boolean {
  return typeof days !== 'number' || !Number.isFinite(days) || days <= 0;
}

/** Bengali has no plural inflection here, so the words never change. */
function formatBengaliDuration(total: number, nights: number): string {
  const dayPart = `${toBengaliDigits(String(total))} দিন`;
  return nights === 0 ? dayPart : `${dayPart} / ${toBengaliDigits(String(nights))} রাত`;
}

/**
 * `3 Days / 2 Nights`, `1 Day` (a day trip has no nights), or '' when unset.
 * In Bengali: `৩ দিন / ২ রাত`.
 */
export function formatDuration(
  days: number | null | undefined,
  locale: NumberLocale = 'en',
): string {
  if (unset(days)) return '';

  const total = Math.floor(days as number);
  const nights = tourNights(total);
  if (locale === 'bn') return formatBengaliDuration(total, nights);

  const dayPart = `${total} ${total === 1 ? 'Day' : 'Days'}`;
  if (nights === 0) return dayPart;

  return `${dayPart} / ${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
}

/**
 * `3D/2N` for chips and rows too narrow for the long form. The abbreviation is
 * an English device, so Bengali gets the readable form instead of `৩দ/২র`.
 */
export function formatDurationShort(
  days: number | null | undefined,
  locale: NumberLocale = 'en',
): string {
  if (unset(days)) return '';
  if (locale === 'bn') return formatDuration(days, 'bn');

  const total = Math.floor(days as number);
  const nights = tourNights(total);
  return nights === 0 ? `${total}D` : `${total}D/${nights}N`;
}
