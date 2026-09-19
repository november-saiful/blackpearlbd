import { describe, expect, it } from 'vitest';
import type { TourDeal } from '@/types';
import { DEAL_SORT_DEFAULT, DEAL_SORT_OPTIONS, isDealSort, sortDeals } from './deals-sort';

/** A whole deal, so no test has to cast a partial. */
function deal(overrides: Partial<TourDeal> = {}): TourDeal {
  return {
    id: 'deal-1',
    deal_code: 'BP-1',
    title: 'Kuakata Sea & Heritage Tour',
    slug: 'kuakata-sea',
    description: 'A three day trip',
    description_align: null,
    short_description: 'Sunrise and sunset over the bay',
    destination: 'Kuakata',
    category: 'beach',
    price: 9800,
    original_price: 12000,
    duration_days: 3,
    max_travelers: 20,
    image_url: null,
    gallery: [],
    hidden_gallery: [],
    inclusions: [],
    exclusions: [],
    itinerary: [],
    route_waypoints: null,
    route_geometry: null,
    is_active: true,
    is_featured: false,
    avg_rating: 0,
    review_count: 0,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Three deals in the order the API returns them (newest first). Prices ascend
 * out of order on purpose, and the two featured ones are not adjacent, so a
 * comparator that did nothing would not pass by accident.
 */
function sample(): TourDeal[] {
  return [
    deal({ id: 'a', price: 12000, is_featured: false }),
    deal({ id: 'b', price: 9000, is_featured: true }),
    deal({ id: 'c', price: 10000, is_featured: true }),
  ];
}

/** The ids in order, which is what the comparator actually decides. */
function ids(deals: TourDeal[]): string[] {
  return deals.map((d) => d.id);
}

describe('isDealSort', () => {
  it('accepts every value the page offers', () => {
    // Driven by the options list itself, so a new sort cannot ship untested.
    for (const option of DEAL_SORT_OPTIONS) expect(isDealSort(option.value)).toBe(true);
  });

  it('rejects anything else, including the shapes a bad link carries', () => {
    expect(isDealSort('cheapest')).toBe(false);
    expect(isDealSort('Price-Low')).toBe(false);
    expect(isDealSort('')).toBe(false);
    expect(isDealSort(null)).toBe(false);
    expect(isDealSort(undefined)).toBe(false);
  });

  it('names a default that is itself a selectable sort', () => {
    expect(isDealSort(DEAL_SORT_DEFAULT)).toBe(true);
  });
});

describe('sortDeals', () => {
  it('orders by price, cheapest first', () => {
    expect(ids(sortDeals(sample(), 'price-low'))).toEqual(['b', 'c', 'a']);
  });

  it('orders by price, dearest first', () => {
    expect(ids(sortDeals(sample(), 'price-high'))).toEqual(['a', 'c', 'b']);
  });

  it('compares prices as numbers, not as formatted text', () => {
    // Lexically "10000" sorts before "9000", so this is the pair that catches a
    // comparator built on the formatted price string.
    const deals = [
      deal({ id: 'dearer', price: 10000 }),
      deal({ id: 'cheaper', price: 9000 }),
    ];
    expect(ids(sortDeals(deals, 'price-low'))).toEqual(['cheaper', 'dearer']);
  });

  it('floats featured deals to the top and keeps the rest as they were', () => {
    // b before c, the order they arrived in: same featured flag, stable sort.
    expect(ids(sortDeals(sample(), 'featured'))).toEqual(['b', 'c', 'a']);
  });

  it('leaves the API order alone for the newest sort', () => {
    expect(ids(sortDeals(sample(), 'newest'))).toEqual(['a', 'b', 'c']);
  });

  it('does not reorder the array it was given, for any sort', () => {
    // The caller's array is the query's own; sorting it in place would reorder
    // the next filter pass too. Every sort is checked, because each one is a
    // separate chance to forget the copy.
    const before = ['a', 'b', 'c'];

    for (const option of DEAL_SORT_OPTIONS) {
      const deals = sample();
      sortDeals(deals, option.value);
      expect(ids(deals), `sort "${option.value}" reordered its input`).toEqual(before);
    }
  });

  it('handles an empty list and a single deal', () => {
    expect(sortDeals([], 'price-high')).toEqual([]);

    const only = deal({ id: 'solo', price: 500 });
    expect(ids(sortDeals([only], 'price-low'))).toEqual(['solo']);
  });

  it('leaves equal prices in the order they arrived', () => {
    const deals = [
      deal({ id: 'first', price: 7000 }),
      deal({ id: 'second', price: 7000 }),
    ];
    expect(ids(sortDeals(deals, 'price-low'))).toEqual(['first', 'second']);
  });
});
