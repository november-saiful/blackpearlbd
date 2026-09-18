import { BanknoteIcon, CompassIcon, MapPinIcon } from 'lucide-react';
import { DEFAULT_FILTER_OPERATORS } from '@/components/reui/filters/filters-operators';
import type {
  FilterField,
  FilterNode,
  FilterOperator,
  FilterOption,
  FilterQuery,
  FilterRule,
  FilterValueType,
} from '@/components/reui/filters/filters-types';
import { buildDestinationOptions } from './deals-destination';
import { DEAL_CATEGORIES, getCategoryByKey, getDealCategory } from '@/lib/deal-category';
import type { PackageDestination, TourDeal } from '@/types';

/**
 * The three facets the deals list is filtered by: where a tour goes, what kind
 * of trip it is, and what it costs. Deliberately not a fourth: duration and
 * featured were offered once and read as noise - a trip's length is visible on
 * its card, and "Featured" is a merchandising flag, not something a visitor
 * came looking for.
 *
 * Field ids. Also the accessor keys below, so the two cannot drift apart, and
 * the URL param names, so a shared link spells them the same way.
 */
export type DealFilterFieldId = 'destination' | 'category' | 'price';

/** What a deal looks like to the filter: one value per field. */
type DealFilterValue = string | null;

const DEAL_FILTER_ACCESSORS: Record<DealFilterFieldId, (deal: TourDeal) => DealFilterValue> = {
  destination: (deal) => deal.destination?.trim() || '',
  category: (deal) => getDealCategory(deal).key,
  price: (deal) => priceBucketKey(deal.price),
};

/* -------------------------------------------------------------------------- */
/*                                  Pricing                                   */
/* -------------------------------------------------------------------------- */

/**
 * The pricing facet, as ranges.
 *
 * Buckets rather than a number field because a visitor arrives with a budget in
 * mind and no idea what this catalogue's prices look like: "is less than or
 * equal to" is a blank box that only answers a number they already know, while
 * four named ranges answer "what can I get for five thousand" on sight.
 *
 * The chip stores the bucket's KEY, not its bounds, so the field stays an
 * ordinary select and the matcher needs no arithmetic: the accessor below
 * answers with the key of the bucket a deal's price falls in, which compares to
 * the chip's value like any other string. That is also what makes the bounds
 * free to be reworded, or a bucket split, without touching the matcher or the
 * links already in the wild.
 *
 * The buckets PARTITION the line - `test` of each is exclusive at the top and
 * the last has no ceiling - so every priced deal lands in exactly one and no
 * deal can fall between two ranges.
 */
export const DEAL_PRICE_BUCKETS = [
  { key: 'under-5000', label: 'Under ৳5,000', test: (price: number) => price < 5000 },
  { key: '5000-10000', label: '৳5,000 – ৳10,000', test: (price: number) => price >= 5000 && price < 10000 },
  { key: '10000-20000', label: '৳10,000 – ৳20,000', test: (price: number) => price >= 10000 && price < 20000 },
  { key: 'over-20000', label: 'Over ৳20,000', test: (price: number) => price >= 20000 },
] as const;

export type DealPriceBucketKey = (typeof DEAL_PRICE_BUCKETS)[number]['key'];

export function isDealPriceBucket(value: string): value is DealPriceBucketKey {
  return DEAL_PRICE_BUCKETS.some((bucket) => bucket.key === value);
}

/**
 * The bucket a price falls in, or null for a deal that has no price yet.
 *
 * Blank is checked before the conversion, because `Number(null)` and `Number('')`
 * are both a perfectly finite zero: an unpriced deal would otherwise read as the
 * cheapest one on the page. A genuine 0 is a price, and does fall in the first
 * bucket.
 */
export function priceBucketKey(price: unknown): DealFilterValue {
  if (price === undefined || price === null || price === '') return null;
  const amount = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(amount)) return null;
  return DEAL_PRICE_BUCKETS.find((bucket) => bucket.test(amount))?.key ?? null;
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

/**
 * The schema each field carries, minus its options: what it is, the condition a
 * fresh chip starts on, and the operators it offers.
 *
 * Every facet is set membership - a deal goes to one destination, holds one
 * category and sits in one price range - so every field offers the same four
 * conditions and no others. The catalog is trimmed per field rather than taken
 * whole: `is empty` is not a question this page can ask (a deal always has a
 * destination), and offering it would put dead operators in every chip's menu.
 * Types stay the catalog's, so labels and inverses do too.
 *
 * Exported because the URL codec reads the same map: a link that names an
 * operator this field does not offer has to be read back as the field's own
 * default, not restored into a chip that cannot render it.
 */
export const DEAL_FILTER_SCHEMA: Record<
  DealFilterFieldId,
  {
    type: FilterValueType;
    defaultOperator: string;
    operators: string[];
    /** Rejects a restored value the page has no way to draw. */
    isKnownValue?: (value: string) => boolean;
  }
> = {
  destination: {
    // A destination is a name off the catalogue, so it is matched as written
    // and never guessed at: any spelling a deal actually uses is offered below.
    // No `isKnownValue`, because the real names live in the data, not in a list
    // this build ships - and a link naming a destination that has since been
    // retired keeps its chip and shows the empty state, which is the honest
    // answer to "where did my tour go".
    type: 'select',
    defaultOperator: 'is',
    operators: ['is', 'is_not', 'is_any_of', 'is_none_of'],
  },
  category: {
    type: 'select',
    defaultOperator: 'is_any_of',
    operators: ['is', 'is_not', 'is_any_of', 'is_none_of'],
    // A category key this build does not know has no label and no emoji, so a
    // link carrying one is read as no filter on the field rather than as a
    // chip reading `jungle`.
    isKnownValue: (value) => getCategoryByKey(value) !== null,
  },
  price: {
    type: 'select',
    defaultOperator: 'is',
    operators: ['is', 'is_not', 'is_any_of', 'is_none_of'],
    // The one field whose values are this build's own keys, so a link from a
    // build with different bounds is dropped rather than shown as a chip with
    // no label - the ranges would have to be re-picked to mean anything.
    isKnownValue: isDealPriceBucket,
  },
};

function operatorsFor(id: DealFilterFieldId, type: FilterValueType): FilterOperator[] {
  const allowed = DEAL_FILTER_SCHEMA[id].operators;
  return DEFAULT_FILTER_OPERATORS[type].filter((operator) => allowed.includes(operator.value));
}

/**
 * The part of a rendered field the schema owns. A function rather than a bare
 * spread so the schema's extra keys - `isKnownValue`, which the URL codec reads
 * and a `FilterField` has no place for - never leak into the field.
 */
function fieldBase(id: DealFilterFieldId) {
  const { type, defaultOperator } = DEAL_FILTER_SCHEMA[id];
  return { type, defaultOperator, operators: operatorsFor(id, type) };
}

/* -------------------------------------------------------------------------- */
/*                                  Options                                   */
/* -------------------------------------------------------------------------- */

/**
 * One option per destination the admin curates, grouped under their category
 * heading. Built from the curated `PackageDestination` rows the same way the
 * deal-creation combobox builds them, so the filter and the picker always
 * offer the same places.
 *
 * Falls back to a flat list derived from the loaded deals when the destinations
 * table is empty or still loading, so the filter is never blank on a page that
 * already shows cards.
 */
function destinationOptions(
  deals: TourDeal[],
  destinations?: PackageDestination[],
): FilterOption[] {
  // Prefer the curated list when it has active entries.
  if (destinations && destinations.length > 0) {
    const curated = buildDestinationOptions(destinations, '');
    if (curated.length > 0) {
      return curated.map((option) => ({
        value: option.name,
        label: option.name,
      }));
    }
  }

  // Fallback: derive from the loaded deals so the filter is never empty.
  const byKey = new Map<string, string>();
  for (const deal of deals) {
    const label = deal.destination?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, label);
  }
  return [...byKey.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({ value: label, label }));
}

/**
 * The categories this catalogue actually holds, in the order the site declares
 * them (Adventure, Beach…) rather than alphabetically, because the declaration
 * order runs from the outdoors inward and is how the rest of the site lists
 * them.
 *
 * Guessed categories count. `getDealCategory` falls back to reading a deal's
 * own words for rows an admin never categorised, and the grid's cards show
 * those guesses, so a filter that ignored them would hide deals whose badge
 * says exactly what you clicked.
 */
function categoryOptions(deals: TourDeal[]): FilterOption[] {
  const present = new Set(deals.map((deal) => getDealCategory(deal).key));

  return DEAL_CATEGORIES.filter((category) => present.has(category.key)).map((category) => ({
    value: category.key,
    label: category.label,
    icon: <span aria-hidden="true">{category.emoji}</span>,
  }));
}

/**
 * The field schema the bar renders. Options come from the curated destination
 * list when available, falling back to the loaded deals, so a facet never
 * offers a choice that matches nothing.
 */
export function dealFilterFields(
  deals: TourDeal[],
  destinations?: PackageDestination[],
): FilterField[] {
  return [
    {
      id: 'destination',
      label: 'Destination',
      ...fieldBase('destination'),
      placeholder: 'Search destinations...',
      icon: <MapPinIcon />,
      options: destinationOptions(deals, destinations),
      pinSelected: true,
    },
    {
      id: 'category',
      label: 'Category',
      ...fieldBase('category'),
      placeholder: 'Search categories...',
      icon: <CompassIcon />,
      options: categoryOptions(deals),
      pinSelected: true,
    },
    {
      id: 'price',
      label: 'Pricing',
      ...fieldBase('price'),
      icon: <BanknoteIcon />,
      options: DEAL_PRICE_BUCKETS.map((bucket) => ({ value: bucket.key, label: bucket.label })),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*                                  Matching                                  */
/* -------------------------------------------------------------------------- */

/** `""` and `null` are a slot nobody filled in, and no destination or bucket. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/** Case-insensitive, trimmed: the two sides are both names off this page. */
function equals(actual: DealFilterValue, expected: unknown): boolean {
  return String(actual ?? '').trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
}

/**
 * One condition against one deal.
 *
 * Only the operators the schema above offers are answered, and an operator from
 * outside that set matches EVERYTHING rather than nothing: a query restored
 * from a link or a stored view may carry wording this build has never heard of,
 * and hiding the whole catalogue over it would read as an empty site.
 */
function testOperator(actual: DealFilterValue, operator: string, values: unknown[]): boolean {
  switch (operator) {
    case 'is':
    case 'eq':
    case 'is_any_of':
    case 'has_any_of':
      return values.some((value) => equals(actual, value));
    case 'is_not':
    case 'neq':
    case 'is_none_of':
    case 'has_none_of':
      return !values.some((value) => equals(actual, value));
    default:
      return true;
  }
}

function matchesRule(deal: TourDeal, rule: FilterRule): boolean {
  if (rule.operator === '') return true;

  const accessor = DEAL_FILTER_ACCESSORS[rule.path[0] as DealFilterFieldId];
  // A path this build no longer has - `duration`, say, from a link written
  // before the facet was dropped - constrains nothing.
  if (!accessor) return true;

  const values =
    rule.value === undefined || rule.value === null
      ? []
      : Array.isArray(rule.value)
        ? (rule.value as unknown[])
        : [rule.value];

  // A rule exists from the moment its attribute is picked, so `value` is empty
  // for a while. Half-built is not a filter yet: it must not blank the grid.
  if (values.every(isBlank)) return true;

  const matched = testOperator(accessor(deal), rule.operator, values);
  return rule.negated ? !matched : matched;
}

function matchesNode(deal: TourDeal, node: FilterNode): boolean {
  if (node.type === 'rule') return matchesRule(deal, node);
  // An empty group constrains nothing, whichever combinator sits over it.
  if (node.rules.length === 0) return true;
  return node.combinator === 'or'
    ? node.rules.some((child) => matchesNode(deal, child))
    : node.rules.every((child) => matchesNode(deal, child));
}

/** Whether a deal survives the whole query. Groups nest, so both chrome variants work. */
export function matchesDealsFilter(deal: TourDeal, query: FilterQuery): boolean {
  return matchesNode(deal, query);
}
