import { DEFAULT_FILTER_OPERATORS } from '@/components/reui/filters/filters-operators';
import {
  createFilterGroup,
  createFilterQuery,
  createFilterRule,
  isFilterGroup,
  pruneFilterQuery,
} from '@/components/reui/filters/filters-query';
import type {
  FilterCombinator,
  FilterNode,
  FilterOperatorArity,
  FilterQuery,
  FilterRule,
} from '@/components/reui/filters/filters-types';
import { DEAL_FILTER_SCHEMA, type DealFilterFieldId } from './deals-filter';
import { DEAL_SORT_DEFAULT, isDealSort, type DealSort } from './deals-sort';

/* -------------------------------------------------------------------------- */
/*                                 The spelling                               */
/* -------------------------------------------------------------------------- */

/**
 * The filter half of a /deals URL, as a flat set of params - one condition per
 * param, so a filtered view reads as what it is:
 *
 *   /deals?destination=is:Cox's+Bazar&category=is_any_of:beach&price=is:under-5000
 *
 * The key names the field; the value is `[!]<operator>[:<values>]`, where a
 * leading `!` is `negated`, commas separate the members of a list ("is any of"),
 * and an operator on its own means "no value yet". Values are percent-encoded
 * by hand before they are joined, so a destination holding a comma or a colon
 * cannot break the grammar - the params then escape the `%`, which is what makes
 * the value round-trip exactly.
 *
 * A bare value with no operator is read as the field's own default condition.
 * That is the spelling the home page's destination tiles link with
 * (`?destination=Paris`), and the one this page wrote itself while the category
 * facet was called experience (`?category=beach`, `?experience=is_any_of:beach`).
 *
 * A tree with a nested GROUP in it has no flat spelling, so it is parked whole
 * in one param instead:
 *
 *   /deals?f={"c":"and","r":[["price","lte",[5000],0],{"c":"or","r":[…"]}]}
 *
 * `match=any` flips the root group to OR, the one thing the flat spelling cannot
 * carry in a key. Ids are not in either form: they are positional noise, so a
 * restored tree is renumbered `url-1..n` on the way in.
 *
 * The sort rides alongside all of it as `?sort=price-low`, because a link that
 * reopens someone else's order has to say which order that was. The default is
 * spelled by its absence, so a link that means "Newest" stays a link about its
 * filters. `sort` is deliberately not a field in the schema above: it narrows
 * nothing, so no chip represents it and no rule matches on it.
 */
export const DEALS_FILTER_TREE_PARAM = 'f';
export const DEALS_FILTER_MATCH_PARAM = 'match';
export const DEALS_SORT_PARAM = 'sort';
const MATCH_ANY = 'any';

/** Field names a link may still use from before the field was renamed. */
const PARAM_ALIASES: Record<string, DealFilterFieldId> = { experience: 'category' };

/**
 * Field names this page used to have. No longer read, but still deleted when
 * the view is written, so touching the bar cleans a stale link instead of
 * leaving a param that means nothing sitting in it.
 */
const RETIRED_FIELD_IDS = ['duration', 'featured'];

const FIELD_IDS = Object.keys(DEAL_FILTER_SCHEMA) as DealFilterFieldId[];

type EncodedRule = [string, string, unknown, 0 | 1];
type EncodedGroup = { c: FilterCombinator; r: EncodedNode[] };
type EncodedNode = EncodedRule | EncodedGroup;

/** Ids the URL does not carry. Unique within one restore, stable while it lives. */
function idSequence(): () => string {
  let next = 0;
  return () => `url-${(next += 1)}`;
}

function arityFor(id: DealFilterFieldId, operator: string): FilterOperatorArity {
  const schema = DEAL_FILTER_SCHEMA[id];
  const offered = DEFAULT_FILTER_OPERATORS[schema.type].find((entry) => entry.value === operator);
  // An operator the field does not offer is not an arity this page can answer
  // for. One value is the catalog's own default, and the caller has already
  // fallen back to a known operator by here in every path but a stale link.
  return offered && schema.operators.includes(offered.value) ? (offered.arity ?? 'one') : 'one';
}

/**
 * The four characters the token grammar spends: `%` so the escaping is
 * reversible, `,` between values, `:` between operator and values, and `!` for
 * `negated` - escaped in a value so a list cannot be faked, nor a value that
 * begins with an exclamation mark mistaken for a negation.
 *
 * Escaping ONLY these, rather than `encodeURIComponent`, keeps a shared URL
 * legible (`is:Cox's Bazar`, not `is%3ACox%2527s%2520Bazar`): the params escape
 * whatever is left, spaces and apostrophes included, exactly once.
 */
const TOKEN_ESCAPES: Record<string, string> = {
  '%': '%25',
  ',': '%2C',
  ':': '%3A',
  '!': '%21',
};

function escapeTokenPart(value: string): string {
  return value.replace(/[%,:!]/g, (char) => TOKEN_ESCAPES[char]);
}

function unescapeTokenPart(raw: string): string {
  return raw.replace(/%([0-9A-Fa-f]{2})/g, (match, hex: string) => {
    const char = String.fromCharCode(parseInt(hex, 16));
    // Only this layer's own escapes are reversed. Anything else in the URL was
    // decoded by the params already, so a leftover `%2F` is a value, not an
    // escape - in which case the sequence is passed through untouched.
    return Object.values(TOKEN_ESCAPES).includes(match) ? char : match;
  });
}

/** A value as the text a chip shows, or undefined for a slot nobody filled in. */
function coerceScalar(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  return typeof raw === 'string' ? raw : String(raw);
}

/**
 * A rule's `value` in the shape its operator expects: a list for `many`, a
 * scalar for `one`, and nothing for an operator that takes no value. Every
 * field on this page is set membership, so there is no third shape to build.
 */
function shapeValue(id: DealFilterFieldId, operator: string, raw: unknown): unknown {
  const arity = arityFor(id, operator);
  if (arity === 'none') return undefined;

  const entries = Array.isArray(raw)
    ? raw
    : raw === undefined || raw === null || raw === ''
      ? []
      : [raw];

  if (arity === 'many') {
    return entries.map(coerceScalar).filter((entry) => entry !== undefined);
  }
  return coerceScalar(entries[0]);
}

/**
 * The value with anything the page has no way to draw dropped - a category key
 * this build does not know should not come back as a chip reading `jungle` -
 * or null when nothing usable is left, which drops the whole condition.
 */
function keepKnownValues(id: DealFilterFieldId, value: unknown): unknown | null {
  const { isKnownValue } = DEAL_FILTER_SCHEMA[id];
  if (!isKnownValue || value === undefined || value === null) return value;
  if (!Array.isArray(value)) return isKnownValue(String(value)) ? value : null;

  const kept = value.filter((entry) => typeof entry === 'string' && isKnownValue(entry));
  return kept.length === 0 ? null : kept;
}

/* -------------------------------------------------------------------------- */
/*                                   Writing                                  */
/* -------------------------------------------------------------------------- */

function encodeBound(value: unknown): string {
  return value === undefined || value === null ? '' : escapeTokenPart(String(value));
}

/** One condition as its param value, or null when it is not part of the view. */
function encodeRule(rule: FilterRule): string | null {
  const id = rule.path[0] as DealFilterFieldId;
  // A chip still choosing its condition filters nothing, so it is not part of
  // the view and has no business in the link.
  if (!rule.operator || !(id in DEAL_FILTER_SCHEMA)) return null;

  const prefix = `${rule.negated ? '!' : ''}${rule.operator}`;
  const arity = arityFor(id, rule.operator);
  if (arity === 'none') return prefix;

  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  const encoded = values.filter((value) => value !== undefined && value !== null).map(encodeBound);
  return encoded.length === 0 ? prefix : `${prefix}:${encoded.join(',')}`;
}

function encodeNode(node: FilterNode): EncodedNode {
  if (isFilterGroup(node)) return { c: node.combinator, r: node.rules.map(encodeNode) };
  return [
    node.path.join('/'),
    node.operator,
    node.value === undefined ? null : node.value,
    node.negated ? 1 : 0,
  ];
}

/** The params that spell this query, and nothing else. */
export function encodeDealsFilterQuery(query: FilterQuery): URLSearchParams {
  const params = new URLSearchParams();
  const pruned = pruneFilterQuery(query);

  if (pruned.rules.some(isFilterGroup)) {
    params.set(DEALS_FILTER_TREE_PARAM, JSON.stringify(encodeNode(pruned)));
    return params;
  }

  for (const node of pruned.rules) {
    const token = encodeRule(node as FilterRule);
    if (token === null) continue;
    params.append((node as FilterRule).path.join('.'), token);
  }

  // AND is what a missing param means, so only the other one is written - and
  // only when there is a condition for it to combine.
  if (pruned.combinator === 'or' && Array.from(params.keys()).length > 0) {
    params.set(DEALS_FILTER_MATCH_PARAM, MATCH_ANY);
  }

  return params;
}

/** `params` with this page's filter spelling replaced, other params untouched. */
export function applyDealsFilterQuery(params: URLSearchParams, query: FilterQuery): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(DEALS_FILTER_TREE_PARAM);
  next.delete(DEALS_FILTER_MATCH_PARAM);
  for (const field of [...FIELD_IDS, ...RETIRED_FIELD_IDS]) next.delete(field);
  for (const alias of Object.keys(PARAM_ALIASES)) next.delete(alias);
  for (const [key, value] of encodeDealsFilterQuery(query)) next.append(key, value);
  return next;
}

/* -------------------------------------------------------------------------- */
/*                                    Sort                                    */
/* -------------------------------------------------------------------------- */

/** The sort a URL asks for, or the default for a missing or unknown value. */
export function readDealSort(params: URLSearchParams): DealSort {
  const raw = params.get(DEALS_SORT_PARAM);
  return isDealSort(raw) ? raw : DEAL_SORT_DEFAULT;
}

/**
 * The sort param written, or removed when it means the default: `?sort=newest`
 * and no param are one view, and the shorter spelling is the one to keep.
 */
function writeDealSort(params: URLSearchParams, sort: DealSort): URLSearchParams {
  if (sort === DEAL_SORT_DEFAULT) params.delete(DEALS_SORT_PARAM);
  else params.set(DEALS_SORT_PARAM, sort);
  return params;
}

/** The params that spell this query and sort together, and nothing else. */
export function encodeDealsQuery(query: FilterQuery, sort: DealSort): URLSearchParams {
  return writeDealSort(encodeDealsFilterQuery(query), sort);
}

/** `params` with this page's whole spelling replaced, other params untouched. */
export function applyDealsQuery(
  params: URLSearchParams,
  query: FilterQuery,
  sort: DealSort,
): URLSearchParams {
  return writeDealSort(applyDealsFilterQuery(params, query), sort);
}

/* -------------------------------------------------------------------------- */
/*                                   Reading                                  */
/* -------------------------------------------------------------------------- */

/** Every token the URL carries for one field, under its own name and any alias. */
function tokensFor(params: URLSearchParams, field: DealFilterFieldId): string[] {
  const tokens = params.getAll(field);
  for (const [alias, target] of Object.entries(PARAM_ALIASES)) {
    if (target === field) tokens.push(...params.getAll(alias));
  }
  return tokens;
}

function decodeRule(field: DealFilterFieldId, token: string, nextId: () => string): FilterRule | null {
  const schema = DEAL_FILTER_SCHEMA[field];
  const negated = token.startsWith('!');
  const body = negated ? token.slice(1) : token;

  const separator = body.indexOf(':');
  const head = separator === -1 ? body : body.slice(0, separator);
  const rawValue = separator === -1 ? undefined : body.slice(separator + 1);

  // A bare word that is not one of the field's operators is a VALUE: that is
  // the deep-link spelling, and the only reading of `?destination=Paris` that
  // does what it says.
  const named = schema.operators.includes(head);
  const operator = named ? head : schema.defaultOperator;
  const valueToken = named ? rawValue : separator === -1 ? head : rawValue;

  const value =
    valueToken === undefined
      ? undefined
      : shapeValue(
          field,
          operator,
          valueToken === '' ? [] : valueToken.split(',').map(unescapeTokenPart),
        );

  const known = keepKnownValues(field, value);
  if (known === null) return null;

  return createFilterRule({
    id: nextId(),
    path: [field],
    operator,
    value: known,
    negated: negated || undefined,
  });
}

function decodeNode(raw: unknown, nextId: () => string): FilterNode | null {
  if (Array.isArray(raw)) {
    const [path, operator, value, negated] = raw as [unknown, unknown, unknown, unknown];
    if (typeof path !== 'string' || typeof operator !== 'string' || !operator) return null;

    const segments = path.split('/');
    const field = segments[0] as DealFilterFieldId;
    if (!(field in DEAL_FILTER_SCHEMA)) return null;

    const schema = DEAL_FILTER_SCHEMA[field];
    const condition = schema.operators.includes(operator) ? operator : schema.defaultOperator;
    const shaped = keepKnownValues(field, shapeValue(field, condition, value));
    if (shaped === null) return null;

    return createFilterRule({
      id: nextId(),
      path: segments,
      operator: condition,
      value: shaped,
      negated: Boolean(negated),
    });
  }

  if (raw && typeof raw === 'object') {
    const group = raw as { c?: unknown; r?: unknown };
    const rules = Array.isArray(group.r)
      ? group.r
          .map((child) => decodeNode(child, nextId))
          .filter((child): child is FilterNode => child !== null)
      : [];
    return createFilterGroup({
      id: nextId(),
      combinator: group.c === 'or' ? 'or' : 'and',
      rules,
    });
  }

  return null;
}

function decodeTree(raw: string): FilterQuery | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A truncated or hand-edited `f` falls through to the flat params rather
    // than taking the page down with it.
    return null;
  }

  const node = decodeNode(parsed, idSequence());
  if (!node) return null;

  const root = pruneFilterQuery(
    isFilterGroup(node) ? (node as FilterQuery) : createFilterQuery([node]),
  );
  // A tree that prunes down to nothing is a link to an unfiltered page, which
  // the flat spelling says by leaving its params out - not by naming an empty
  // group.
  return root.rules.length === 0 ? null : root;
}

/**
 * The query a URL spells, or null when it spells none: an empty bar is no
 * params at all, not a param saying "nothing".
 */
export function decodeDealsFilterQuery(params: URLSearchParams): FilterQuery | null {
  const tree = params.get(DEALS_FILTER_TREE_PARAM);
  if (tree) {
    const decoded = decodeTree(tree);
    if (decoded) return decoded;
  }

  const nextId = idSequence();
  const rules: FilterRule[] = [];

  for (const field of FIELD_IDS) {
    for (const token of tokensFor(params, field)) {
      const rule = decodeRule(field, token, nextId);
      if (rule) rules.push(rule);
    }
  }

  if (rules.length === 0) return null;

  const combinator: FilterCombinator =
    params.get(DEALS_FILTER_MATCH_PARAM) === MATCH_ANY ? 'or' : 'and';

  return createFilterQuery(rules, combinator);
}

/**
 * The view a URL spells - filters and sort - canonicalised, so `?experience=beach`
 * and `?category=is_any_of:beach` compare equal and arrive spelled the same way.
 * The page uses this to tell "the URL already says what I hold" from "the URL
 * moved under me".
 *
 * Built by decoding and re-encoding, which also fixes the param order: the same
 * view always produces the same string, whatever order the link wrote it in.
 * Params this page does not own are ignored rather than reported, so a URL that
 * carries an unrelated `?utm_source=` still matches the state it agrees with.
 */
export function canonicalDealsQuery(params: URLSearchParams): string {
  const query = decodeDealsFilterQuery(params) ?? createFilterQuery([]);
  return encodeDealsQuery(query, readDealSort(params)).toString();
}
