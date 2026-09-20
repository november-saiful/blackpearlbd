import type { PackageDestination } from '@/types';

/** One row of the destination picker, flattened out of `package_destinations`. */
export type DestinationOption = {
  /**
   * The destination's display name, which is what a deal stores.
   *
   * `tour_deals.destination` is a single text column that shows up verbatim on
   * the deal card, in the /deals destination filter and in the category
   * auto-detect keywords, so the package builder's slug (`chattogram-division`)
   * would print as "chattogram-division" on a card. The name is the value.
   */
  name: string;
  /** The admin's grouping ("Bangladesh", "Asia", …), used as the menu heading. */
  category: string;
};

/** The heading an off-list destination is parked under. */
export const UNLISTED_DESTINATION_GROUP = 'Saved on this deal';

/** The public location label: the specific place first, then its division. */
export function formatDealLocation(destination: string | null | undefined, subDestination?: string | null) {
  const parent = destination?.trim() || '';
  const child = subDestination?.trim() || '';
  if (child && parent && child.toLowerCase() !== parent.toLowerCase()) return `${child}, ${parent}`;
  return child || parent;
}

/** Case-insensitive "does this option match what was typed". */
export function destinationOptionMatches(option: DestinationOption, search: string) {
  const haystack = `${option.name} ${option.category}`.toLowerCase();
  const needle = search.trim().toLowerCase();
  return !needle || haystack.startsWith(needle) || haystack.includes(needle);
}

/**
 * The pickable destinations: the admin's active list, plus whatever this deal
 * already holds.
 *
 * Retired (`is_active = false`) rows are not offered for new picks — that flag
 * is how the destinations sheet takes an option out of circulation — but a deal
 * that already points at one keeps it, so opening the edit dialog never
 * silently rewrites a destination (or leaves the trigger showing a value the
 * menu cannot name).
 */
export function buildDestinationOptions(
  destinations: PackageDestination[],
  current: string,
): DestinationOption[] {
  const ordered = [...destinations].sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

  const seen = new Set<string>();
  const options: DestinationOption[] = [];

  for (const destination of ordered) {
    if (!destination.is_active) continue;
    // Names are the stored value, so two rows sharing one would be one choice.
    if (seen.has(destination.name)) continue;
    seen.add(destination.name);
    options.push({ name: destination.name, category: destination.category });
  }

  if (current && !seen.has(current)) {
    options.unshift({ name: current, category: UNLISTED_DESTINATION_GROUP });
  }

  return options;
}

/** The options that survive a search, grouped under their category heading. */
export function groupDestinationOptions(options: DestinationOption[], search: string) {
  const byCategory = new Map<string, DestinationOption[]>();

  for (const option of options) {
    if (!destinationOptionMatches(option, search)) continue;
    const bucket = byCategory.get(option.category);
    if (bucket) bucket.push(option);
    else byCategory.set(option.category, [option]);
  }

  return Array.from(byCategory.entries()).map(([category, items]) => ({ category, items }));
}
