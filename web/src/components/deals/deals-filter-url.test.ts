import { describe, expect, it } from 'vitest';
import { createFilterGroup, createFilterQuery, createFilterRule } from '@/components/reui/filters/filters-query';
import type { FilterQuery } from '@/components/reui/filters/filters-types';
import {
  applyDealsFilterQuery,
  applyDealsQuery,
  canonicalDealsQuery,
  decodeDealsFilterQuery,
  encodeDealsFilterQuery,
  encodeDealsQuery,
  readDealSort,
} from './deals-filter-url';
import { DEAL_SORT_DEFAULT } from './deals-sort';

const params = (search: string) => new URLSearchParams(search);

/** One rule with a deterministic id, so tests never spell out an id factory. */
let seq = 0;
function rule(
  field: string,
  operator: string,
  value?: unknown,
  options: { negated?: boolean } = {},
) {
  return createFilterRule({
    id: `test-${(seq += 1)}`,
    path: [field],
    operator,
    value,
    negated: options.negated,
  });
}

function query(rules: ReturnType<typeof rule>[], combinator: 'and' | 'or' = 'and'): FilterQuery {
  return createFilterQuery(rules, combinator);
}

/** The URL a query spells, as a string, for the readable assertions. */
const search = (value: FilterQuery) => encodeDealsFilterQuery(value).toString();

/** Round trip: URL string in, URL string out. */
const roundTrip = (search_: string, mutate?: (value: FilterQuery) => FilterQuery) => {
  const decoded = decodeDealsFilterQuery(params(search_));
  expect(decoded).not.toBeNull();
  return search(mutate ? mutate(decoded as FilterQuery) : (decoded as FilterQuery));
};

describe('encodeDealsFilterQuery', () => {
  it('spells one condition per field', () => {
    expect(search(query([rule('destination', 'is', "Cox's Bazar")]))).toBe(
      'destination=is%3ACox%27s+Bazar',
    );
  });

  it('writes a list of picks as commas', () => {
    expect(search(query([rule('category', 'is_any_of', ['beach', 'hill'])]))).toBe(
      'category=is_any_of%3Abeach%2Chill',
    );
    expect(search(query([rule('price', 'is_any_of', ['under-5000', '5000-10000'])]))).toBe(
      'price=is_any_of%3Aunder-5000%2C5000-10000',
    );
  });

  it('writes a pricing bucket as the key the field stores', () => {
    expect(search(query([rule('price', 'is', 'under-5000')]))).toBe('price=is%3Aunder-5000');
    expect(roundTrip('price=is%3Aunder-5000')).toBe('price=is%3Aunder-5000');
  });

  it('marks a negated condition and a valueless one', () => {
    expect(search(query([rule('category', 'is_not', 'beach', { negated: true })]))).toBe(
      'category=%21is_not%3Abeach',
    );
  });

  it('writes a condition whose operator takes no value on its own', () => {
    expect(search(query([rule('destination', 'is')]))).toBe('destination=is');
  });

  it('leaves a chip that has not chosen its condition out entirely', () => {
    expect(search(query([rule('destination', '', undefined)]))).toBe('');
  });

  it('writes nothing at all for an empty query', () => {
    expect(search(query([]))).toBe('');
  });

  it('says `match=any` only when the root group is ORed', () => {
    expect(search(query([rule('price', 'is', 'under-5000')], 'or'))).toBe(
      'price=is%3Aunder-5000&match=any',
    );
    expect(search(query([rule('price', 'is', 'under-5000')], 'and'))).toBe('price=is%3Aunder-5000');
  });

  it('keeps both conditions when one field is filtered twice', () => {
    expect(search(query([rule('destination', 'is', 'Kuakata'), rule('destination', 'is', 'Bandarban')]))).toBe(
      'destination=is%3AKuakata&destination=is%3ABandarban',
    );
  });

  it('survives a value holding the characters the grammar uses', () => {
    const tricky = "মানিকগঞ্জ, বাংলাদেশ: part 2";

    expect(roundTrip(search(query([rule('destination', 'is', tricky)])))).toBe(
      search(query([rule('destination', 'is', tricky)])),
    );
  });

  it('parks a nested group in the tree param, where a flat spelling cannot reach', () => {
    const nested = createFilterQuery([
      rule('category', 'is_any_of', ['beach']),
      createFilterGroup({
        id: 'nested',
        combinator: 'or',
        rules: [rule('price', 'is', 'under-5000'), rule('destination', 'is', 'Sundarban')],
      }),
    ]);

    const encoded = encodeDealsFilterQuery(nested);
    expect(encoded.get('f')).toContain('"c":"or"');
    expect(encoded.toString()).not.toContain('category=');
  });
});

describe('decodeDealsFilterQuery', () => {
  it('reads nothing out of an empty bar', () => {
    expect(decodeDealsFilterQuery(params(''))).toBeNull();
  });

  it('reads a condition written the way this module writes it', () => {
    const decoded = decodeDealsFilterQuery(params('destination=is%3ACox%27s+Bazar'))!;

    expect(decoded.rules[0]).toMatchObject({
      type: 'rule',
      path: ['destination'],
      operator: 'is',
      value: "Cox's Bazar",
    });
  });

  it('reads a list as a list and a bucket as its key', () => {
    const decoded = decodeDealsFilterQuery(params('price=is_any_of%3Aunder-5000%2Cover-20000'))!;

    expect(decoded.rules[0]).toMatchObject({
      operator: 'is_any_of',
      value: ['under-5000', 'over-20000'],
    });
  });

  it('takes a bare value as the field’s own default condition', () => {
    const decoded = decodeDealsFilterQuery(params('destination=Paris'))!;

    expect(decoded.rules[0]).toMatchObject({ operator: 'is', value: 'Paris' });
  });

  it('still answers to the spelling this page wrote while the facet was called experience', () => {
    const decoded = decodeDealsFilterQuery(params('experience=beach'))!;

    // A list operator holds a list, matching what the menu itself writes.
    expect(decoded.rules[0]).toMatchObject({
      path: ['category'],
      operator: 'is_any_of',
      value: ['beach'],
    });
  });

  it('drops a category this build cannot draw, and keeps an unknown destination', () => {
    expect(decodeDealsFilterQuery(params('category=jungle'))).toBeNull();

    const unknownDestination = decodeDealsFilterQuery(params('destination=Atlantis'))!;
    expect(unknownDestination.rules[0]).toMatchObject({ value: 'Atlantis' });
  });

  it('keeps the categories it can draw when a link lists one it cannot', () => {
    const decoded = decodeDealsFilterQuery(params('category=beach%2Cjungle'))!;

    expect(decoded.rules[0]).toMatchObject({ value: ['beach'] });
  });

  it('drops a pricing bucket this build does not offer', () => {
    // A link from a build with different bounds cannot be shown as a chip, so it
    // is read as no filter on the field rather than as a range nothing labels.
    expect(decodeDealsFilterQuery(params('price=is%3Aunder-4000'))).toBeNull();
    // A numeric condition is that same case: `lte` is no longer offered, so the
    // condition falls back to `is` and its value is not a bucket.
    expect(decodeDealsFilterQuery(params('price=lte%3A5000'))).toBeNull();
  });

  it('falls back to the field default rather than restoring an operator it cannot show', () => {
    const decoded = decodeDealsFilterQuery(params('price=contains%3Aunder-5000'))!;

    expect(decoded.rules[0]).toMatchObject({ operator: 'is', value: 'under-5000' });
  });

  it('reads `match=any` as an ORed root group', () => {
    expect(decodeDealsFilterQuery(params('price=is%3Aunder-5000&match=any'))!.combinator).toBe('or');
    expect(decodeDealsFilterQuery(params('price=is%3Aunder-5000'))!.combinator).toBe('and');
  });

  it('reads back the tree param, nested groups included', () => {
    const searchString = search(
      createFilterQuery([
        rule('category', 'is_any_of', ['beach']),
        createFilterGroup({
          id: 'nested',
          combinator: 'or',
          rules: [rule('price', 'is', 'under-5000'), rule('destination', 'is', 'Sundarban')],
        }),
      ]),
    );

    const decoded = decodeDealsFilterQuery(params(searchString))!;
    const nested = decoded.rules[1];

    expect(nested).toMatchObject({ type: 'group', combinator: 'or' });
    expect(search(decoded)).toBe(searchString);
  });

  it('ignores a tree param that is not a tree', () => {
    expect(decodeDealsFilterQuery(params('f=%7Bnope'))).toBeNull();
    expect(
      decodeDealsFilterQuery(params('f=%7B%22c%22%3A%22and%22%2C%22r%22%3A%5B%5D%7D')),
    ).toBeNull();
  });

  it('gives every restored node its own id', () => {
    const decoded = decodeDealsFilterQuery(params('destination=is%3AKuakata&destination=is%3ABandarban'))!;
    const ids = decoded.rules.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps a percent sign and a comma inside a value', () => {
    const value = '50% off, really';

    expect(decodeDealsFilterQuery(params(search(query([rule('destination', 'is', value)]))))!.rules[0]).toMatchObject({
      value,
    });
  });
});

describe('readDealSort', () => {
  it('reads a sort this page can draw', () => {
    expect(readDealSort(params('sort=price-low'))).toBe('price-low');
  });

  it('falls back to the default for a missing or unknown sort', () => {
    expect(readDealSort(params(''))).toBe(DEAL_SORT_DEFAULT);
    expect(readDealSort(params('sort=banana'))).toBe(DEAL_SORT_DEFAULT);
    expect(readDealSort(params('sort=PRICE-LOW'))).toBe(DEAL_SORT_DEFAULT);
  });
});

describe('encodeDealsQuery', () => {
  it('adds the sort to the filter spelling', () => {
    const encoded = encodeDealsQuery(query([rule('destination', 'is', 'Paris')]), 'price-low');

    expect(encoded.get('destination')).toBe('is:Paris');
    expect(encoded.get('sort')).toBe('price-low');
  });

  it('does not spell out the default sort', () => {
    expect(encodeDealsQuery(query([rule('destination', 'is', 'Paris')]), 'newest').toString()).toBe(
      'destination=is%3AParis',
    );
  });

  it('leaves the sort out of an empty view entirely', () => {
    expect(encodeDealsQuery(query([]), 'newest').toString()).toBe('');
  });
});

describe('applyDealsQuery', () => {
  it('writes the filter and the sort in one pass', () => {
    const next = applyDealsQuery(
      params('destination=Atlantis'),
      query([rule('price', 'is', 'under-5000')]),
      'featured',
    );

    expect(next.get('destination')).toBeNull();
    expect(next.get('price')).toBe('is:under-5000');
    expect(next.get('sort')).toBe('featured');
  });

  it('removes the sort param when the sort goes back to the default', () => {
    const next = applyDealsQuery(params('sort=price-high&price=is%3Aover-20000'), query([]), 'newest');

    expect(next.toString()).toBe('');
  });

  it('leaves a param it does not own alone', () => {
    const next = applyDealsQuery(params('utm_source=newsletter'), query([]), 'price-low');

    expect(next.get('utm_source')).toBe('newsletter');
    expect(next.get('sort')).toBe('price-low');
  });
});

describe('canonicalDealsQuery', () => {
  it('spells two links for one view the same way', () => {
    expect(canonicalDealsQuery(params('experience=beach'))).toBe(
      canonicalDealsQuery(params('category=is_any_of%3Abeach')),
    );
  });

  it('is empty when the view is unfiltered and unsorted', () => {
    expect(canonicalDealsQuery(params(''))).toBe('');
  });

  it('ignores a param this page does not own', () => {
    expect(canonicalDealsQuery(params('utm_source=newsletter&destination=Paris'))).toBe(
      canonicalDealsQuery(params('destination=Paris')),
    );
  });

  it('spells the default sort and its absence the same way, in either order', () => {
    expect(canonicalDealsQuery(params('sort=newest'))).toBe('');
    expect(canonicalDealsQuery(params('sort=price-low&destination=Paris'))).toBe(
      canonicalDealsQuery(params('destination=Paris&sort=price-low')),
    );
  });

  it('keeps the sort of a view whose filters are unknown', () => {
    // The chips cannot be drawn, but the order can still be honoured, so the
    // two halves are not allowed to decide each other's fate.
    expect(canonicalDealsQuery(params('category=jungle&sort=featured'))).toBe('sort=featured');
  });
});

describe('applyDealsFilterQuery', () => {
  it('replaces the filter params and leaves the rest of the URL alone', () => {
    const next = applyDealsFilterQuery(
      params('sort=price-low&experience=beach&destination=Paris'),
      query([rule('category', 'is', 'hill')]),
    );

    expect(next.get('sort')).toBe('price-low');
    expect(next.get('destination')).toBeNull();
    expect(next.get('experience')).toBeNull();
    expect(next.get('category')).toBe('is:hill');
  });

  it('scrubs the facets this page used to have', () => {
    // Duration and Featured are gone from the schema; a link that still names
    // them should not keep them once the view is written back.
    const next = applyDealsFilterQuery(
      params('duration=gte%3A3&featured=is%3Atrue&destination=Kuakata'),
      query([rule('destination', 'is', 'Kuakata')]),
    );

    expect(next.get('duration')).toBeNull();
    expect(next.get('featured')).toBeNull();
    expect(next.toString()).toBe('destination=is%3AKuakata');
  });

  it('clears the filter params when the bar is emptied', () => {
    const next = applyDealsFilterQuery(params('sort=price-low&price=lte%3A5000'), query([]));

    expect(next.toString()).toBe('sort=price-low');
  });

  it('round-trips what the page is holding', () => {
    const held = query([rule('destination', 'is', "Cox's Bazar"), rule('price', 'is', '10000-20000')]);
    const next = applyDealsFilterQuery(params(''), held);

    expect(canonicalDealsQuery(next)).toBe(canonicalDealsQuery(encodeDealsFilterQuery(held)));
  });
});
