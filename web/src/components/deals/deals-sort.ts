import type { TourDeal } from '@/types';

/**
 * The sorts this page can draw, in one place because three things point at it:
 * the Select's items, the `sort` param's grammar (see `./deals-filter-url`), and
 * the comparator below.
 *
 * A value that is not in here is not a sort the page can show, so a link
 * carrying one falls back to the default rather than ordering the grid by
 * something nothing on screen names.
 */
export const DEAL_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'featured', label: 'Featured' },
] as const;

export type DealSort = (typeof DEAL_SORT_OPTIONS)[number]['value'];

/** What the list falls back to, and the one sort the URL does not spell out. */
export const DEAL_SORT_DEFAULT: DealSort = 'newest';

export function isDealSort(value: string | null | undefined): value is DealSort {
  return value != null && DEAL_SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * Sorted on the numbers themselves, not on the formatted price string, and
 * never in place - the caller's array is the API's own, and mutating it would
 * reorder the next filter pass as well.
 */
export function sortDeals(deals: TourDeal[], sort: DealSort): TourDeal[] {
  switch (sort) {
    case 'price-low':
      return [...deals].sort((a, b) => a.price - b.price);
    case 'price-high':
      return [...deals].sort((a, b) => b.price - a.price);
    case 'featured':
      return [...deals].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    case 'newest':
    default:
      // Keep the API order, which is newest first.
      return deals;
  }
}
