import { describe, expect, it } from 'vitest';
import { createFilterRule, createFilterQuery } from '@/components/reui/filters/filters-query';
import type { FilterNode, FilterQuery } from '@/components/reui/filters/filters-types';
import type { TourDeal } from '@/types';
import { DEAL_PRICE_BUCKETS, dealFilterFields, matchesDealsFilter, priceBucketKey } from './deals-filter';

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
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A flat query, which is what the basic chip bar produces. */
function query(...rules: FilterNode[]): FilterQuery {
  return createFilterQuery(rules);
}

/** One rule, on `operator` with `value`. */
function rule(
  path: string,
  operator: string,
  value?: unknown,
  negated = false,
): FilterNode {
  return createFilterRule({ id: `${path}-${operator}`, path: [path], operator, value, negated });
}

/** The options of one field, as values. */
function options(fields: ReturnType<typeof dealFilterFields>, id: string): unknown[] {
  return fields.find((field) => field.id === id)?.options?.map((option) => option.value) ?? [];
}

const BEACH = deal({ category: 'beach', price: 9800, destination: 'Kuakata' });
const HILL = deal({
  id: 'deal-2',
  title: 'Bandarban Hill Trek',
  destination: 'Bandarban',
  category: 'hill',
  price: 14500,
});

describe('priceBucketKey', () => {
  it('puts every price in exactly one bucket', () => {
    const prices = [0, 1, 4999, 5000, 5001, 9999, 10000, 19999, 20000, 20001, 1_000_000];

    for (const price of prices) {
      const key = priceBucketKey(price);
      const holders = DEAL_PRICE_BUCKETS.filter((bucket) => bucket.test(price));

      expect(key).not.toBeNull();
      // One bucket each, so a deal can never be counted twice nor fall through.
      expect(holders).toHaveLength(1);
      expect(holders[0].key).toBe(key);
    }
  });

  it('breaks the boundaries the way the labels read', () => {
    expect(priceBucketKey(4999)).toBe('under-5000');
    expect(priceBucketKey(5000)).toBe('5000-10000');
    expect(priceBucketKey(9999)).toBe('5000-10000');
    expect(priceBucketKey(10000)).toBe('10000-20000');
    expect(priceBucketKey(19999)).toBe('10000-20000');
    expect(priceBucketKey(20000)).toBe('over-20000');
  });

  it('reads a numeric string, and answers null for a deal with no price', () => {
    expect(priceBucketKey('12000')).toBe('10000-20000');
    expect(priceBucketKey(null)).toBeNull();
    expect(priceBucketKey(undefined)).toBeNull();
    expect(priceBucketKey('')).toBeNull();
    expect(priceBucketKey('free')).toBeNull();
  });
});

describe('matchesDealsFilter', () => {
  it('matches everything when the query is empty', () => {
    expect(matchesDealsFilter(BEACH, query())).toBe(true);
    expect(matchesDealsFilter(HILL, query())).toBe(true);
  });

  it('matches a destination regardless of case, and rejects the others', () => {
    const q = query(rule('destination', 'is', 'kuakata'));

    expect(matchesDealsFilter(BEACH, q)).toBe(true);
    expect(matchesDealsFilter(HILL, q)).toBe(false);
  });

  it('matches any of the picked options, and none of them', () => {
    expect(matchesDealsFilter(HILL, query(rule('destination', 'is_any_of', ['kuakata', 'bandarban'])))).toBe(true);
    expect(matchesDealsFilter(BEACH, query(rule('destination', 'is_any_of', ['bandarban'])))).toBe(false);
    expect(matchesDealsFilter(BEACH, query(rule('destination', 'is_none_of', ['bandarban'])))).toBe(true);
    expect(matchesDealsFilter(BEACH, query(rule('destination', 'is_none_of', ['kuakata'])))).toBe(false);
  });

  it('filters on the derived category, not just the stored column', () => {
    // No stored category, so `getDealCategory` reads the title and description.
    const untagged = deal({
      category: null,
      destination: 'Khulna',
      title: 'Sundarban Mangrove Adventure',
      short_description: 'Into the forest',
    });

    expect(matchesDealsFilter(untagged, query(rule('category', 'is', 'nature')))).toBe(true);
    expect(matchesDealsFilter(untagged, query(rule('category', 'is', 'beach')))).toBe(false);
  });

  it('matches the pricing bucket a deal falls in', () => {
    // Kuakata is 9,800 and Bandarban 14,500, so one bucket separates them.
    expect(matchesDealsFilter(BEACH, query(rule('price', 'is', '5000-10000')))).toBe(true);
    expect(matchesDealsFilter(HILL, query(rule('price', 'is', '5000-10000')))).toBe(false);
    expect(matchesDealsFilter(HILL, query(rule('price', 'is', '10000-20000')))).toBe(true);
  });

  it('picks up the two buckets a range of picks names', () => {
    const cheap = query(rule('price', 'is_any_of', ['under-5000', '5000-10000']));
    const dear = query(rule('price', 'is_none_of', ['under-5000', '5000-10000']));

    expect(matchesDealsFilter(BEACH, cheap)).toBe(true);
    expect(matchesDealsFilter(HILL, dear)).toBe(true);
    expect(matchesDealsFilter(HILL, cheap)).toBe(false);
    expect(matchesDealsFilter(BEACH, dear)).toBe(false);
  });

  it('leaves a deal with no price out of every bucket', () => {
    const unpriced = deal({ price: null as unknown as number });

    expect(matchesDealsFilter(unpriced, query(rule('price', 'is', 'under-5000')))).toBe(false);
    // "is not under 5,000" is true of a deal that has no price to range: it is
    // not in that bucket.
    expect(matchesDealsFilter(unpriced, query(rule('price', 'is_not', 'under-5000')))).toBe(true);
  });

  it('ignores a rule that has no value yet', () => {
    expect(matchesDealsFilter(BEACH, query(rule('price', 'is', undefined)))).toBe(true);
    expect(matchesDealsFilter(BEACH, query(rule('price', 'is', '')))).toBe(true);
    expect(matchesDealsFilter(BEACH, query(rule('price', 'is_any_of', [])))).toBe(true);
  });

  it('ignores a facet, or an operator, this build does not know', () => {
    // `duration` was a facet once; a link that still names it constrains
    // nothing rather than hiding the catalogue.
    expect(matchesDealsFilter(BEACH, query(rule('duration', 'gt', 30)))).toBe(true);
    expect(matchesDealsFilter(BEACH, query(rule('price', 'sounds_like', '5000-10000')))).toBe(true);
    // A numeric condition is no longer something a price can answer, and the
    // matcher's answer to that is "no opinion" rather than "no match".
    expect(matchesDealsFilter(BEACH, query(rule('price', 'lte', 5000)))).toBe(true);
  });

  it('flips a condition when it is negated', () => {
    expect(matchesDealsFilter(BEACH, query(rule('destination', 'is', 'kuakata', true)))).toBe(false);
    expect(matchesDealsFilter(HILL, query(rule('destination', 'is', 'kuakata', true)))).toBe(true);
  });

  it('ands the root and honours a nested or', () => {
    const anded = query(
      rule('destination', 'is', 'kuakata'),
      rule('price', 'is', '5000-10000'),
    );
    expect(matchesDealsFilter(BEACH, anded)).toBe(true);

    const group: FilterNode = {
      id: 'group-1',
      type: 'group',
      combinator: 'or',
      rules: [rule('destination', 'is', 'bandarban'), rule('price', 'is', '5000-10000')],
    };
    expect(matchesDealsFilter(BEACH, query(group))).toBe(true);
    expect(matchesDealsFilter(HILL, query(group))).toBe(true);

    const neither = query(
      rule('destination', 'is', 'bandarban'),
      {
        id: 'group-2',
        type: 'group',
        combinator: 'or',
        rules: [rule('price', 'is', 'over-20000'), rule('category', 'is', 'hill')],
      } as FilterNode,
    );
    expect(matchesDealsFilter(BEACH, neither)).toBe(false);
  });

  it('ignores an empty group', () => {
    expect(
      matchesDealsFilter(BEACH, query({ id: 'g', type: 'group', combinator: 'and', rules: [] }))
    ).toBe(true);
  });
});

describe('dealFilterFields', () => {
  it('offers the three facets, in order', () => {
    expect(dealFilterFields([BEACH]).map((field) => field.id)).toEqual([
      'destination',
      'category',
      'price',
    ]);
  });

  it('offers the loaded destinations only, once each and in order', () => {
    const fields = dealFilterFields([
      HILL,
      BEACH,
      deal({ id: 'deal-3', destination: 'Kuakata' }),
      // Same place, different spelling: one option, the first spelling kept.
      deal({ id: 'deal-4', destination: '  kuakata ' }),
      deal({ id: 'deal-5', destination: null as unknown as string }),
    ]);

    expect(options(fields, 'destination')).toEqual(['Bandarban', 'Kuakata']);
  });

  it('offers only the categories this catalogue actually holds', () => {
    const fields = dealFilterFields([BEACH]);
    const offered = options(fields, 'category');

    expect(offered).toEqual(['beach']);
    expect(fields.find((field) => field.id === 'category')?.defaultOperator).toBe('is_any_of');
  });

  it('keeps the declared order of the categories, not the alphabetical one', () => {
    const fields = dealFilterFields([HILL, BEACH]);

    // Adventure is declared before Beach, and Beach before Hills & Tea.
    expect(options(fields, 'category')).toEqual(['beach', 'hill']);
  });

  it('labels each category option and carries its emoji', () => {
    const beach = dealFilterFields([BEACH])
      .find((field) => field.id === 'category')
      ?.options?.find((option) => option.value === 'beach');

    expect(beach?.label).toBe('Beach & Islands');
    expect(beach?.icon).toBeTruthy();
  });

  it('offers the pricing buckets, in order, with the keys the URL uses', () => {
    const fields = dealFilterFields([BEACH]);

    expect(options(fields, 'price')).toEqual(['under-5000', '5000-10000', '10000-20000', 'over-20000']);
    expect(fields.find((field) => field.id === 'price')?.defaultOperator).toBe('is');
  });

  it('gives every facet the same four conditions, and no valueless one', () => {
    const fields = dealFilterFields([BEACH]);
    const operators = (id: string) => {
      const declared = fields.find((field) => field.id === id)?.operators;
      return Array.isArray(declared) ? declared.map((operator) => operator.value) : [];
    };

    // A deal always has a destination and a category, and asking for an empty
    // one is not a question this page can answer.
    for (const id of ['destination', 'category', 'price']) {
      expect(operators(id)).toEqual(['is', 'is_not', 'is_any_of', 'is_none_of']);
    }
  });

  it('renders a locked-down field for an empty catalogue', () => {
    // No deals yet: the bar still draws, with nothing to pick.
    const fields = dealFilterFields([]);

    expect(options(fields, 'destination')).toEqual([]);
    expect(options(fields, 'category')).toEqual([]);
    expect(options(fields, 'price')).toHaveLength(4);
  });
});
