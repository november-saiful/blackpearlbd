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

/** `3 Days / 2 Nights`, `1 Day` (a day trip has no nights), or '' when unset. */
export function formatDuration(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return '';

  const total = Math.floor(days);
  const nights = tourNights(total);
  const dayPart = `${total} ${total === 1 ? 'Day' : 'Days'}`;
  if (nights === 0) return dayPart;

  return `${dayPart} / ${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
}

/** `3D/2N` for chips and rows too narrow for the long form. */
export function formatDurationShort(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return '';

  const total = Math.floor(days);
  const nights = tourNights(total);
  return nights === 0 ? `${total}D` : `${total}D/${nights}N`;
}
