import { describe, expect, it } from 'vitest';
import type { TourDeal } from '@/types';
import { DEAL_SORT_OPTIONS, isDealSort, sortDeals } from './deals-sort';

/** Only the columns the comparator reads, so a case reads as its ordering. */
function deal(id: string, price: number, is_featured = false): TourDeal {
  return { id, price, is_featured } as TourDeal;
}

const deals = [
  deal('a', 9000, false),
  deal('b', 2500, true),
  deal('c', 12000, true),
  deal('d', 2500, false),
];

const ids = (sorted: TourDeal[]) => sorted.map((entry) => entry.id);

describe('isDealSort', () => {
  it('accepts every sort the menu offers', () => {
    for (const option of DEAL_SORT_OPTIONS) expect(isDealSort(option.value)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isDealSort('banana')).toBe(false);
    expect(isDealSort('')).toBe(false);
    expect(isDealSort(null)).toBe(false);
    expect(isDealSort(undefined)).toBe(false);
  });
});

describe('sortDeals', () => {
  it('leaves the API order alone for the default sort', () => {
    expect(ids(sortDeals(deals, 'newest'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts on the price, low and high', () => {
    expect(ids(sortDeals(deals, 'price-low'))).toEqual(['b', 'd', 'a', 'c']);
    expect(ids(sortDeals(deals, 'price-high'))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('sorts featured first', () => {
    expect(ids(sortDeals(deals, 'featured'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('never reorders the array it was handed', () => {
    // The same array backs the next filter pass, so sorting in place would
    // leave the list scrambled after a single filter change.
    const original = [...deals];
    sortDeals(deals, 'price-high');

    expect(ids(deals)).toEqual(ids(original));
  });

  it('answers with an empty list for an empty list', () => {
    expect(sortDeals([], 'featured')).toEqual([]);
  });
});
