/**
 * The crawlable body served inside `<div id="root">`.
 *
 * These pages are a single-page app: the HTML the server would otherwise send
 * contains no copy, no links and no headings, so a crawler that does not run
 * JavaScript sees an empty document. This module composes the same content as
 * plain markup, so every page has real text and real internal links to follow.
 *
 * It is replaced the moment React commits, so it is written to look like the
 * page it stands in for: semantic elements, inherited type, no fixed colours
 * (the theme's own background and foreground show through), and no scripting.
 */
import { escapeHtml, PAGE_META, type DealLike } from '../../src/lib/seo';
import { humanizeDashes } from '../../src/lib/text';

const WRAP_STYLE = 'max-width:72rem;margin:0 auto;padding:6.5rem 1.25rem 3rem;line-height:1.65';
const LIST_STYLE = 'display:grid;gap:0.75rem;padding:0;list-style:none';

/** Max deals a listing page links to before it stops being a page and becomes a dump. */
const HOME_DEAL_LIMIT = 12;
const LIST_DEAL_LIMIT = 60;
const ITINERARY_LIMIT = 20;

const priceFormatter = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
});

function text(value: string | null | undefined): string {
  return escapeHtml(humanizeDashes((value || '').trim()));
}

function price(value: number | null | undefined): string {
  return typeof value === 'number' && value > 0 ? priceFormatter.format(value) : '';
}

function location(deal: DealLike): string {
  const parent = humanizeDashes((deal.destination || '').trim());
  const child = humanizeDashes((deal.sub_destination || '').trim());
  if (child && parent && child.toLowerCase() !== parent.toLowerCase()) return `${child}, ${parent}`;
  return child || parent;
}

function duration(deal: DealLike): string {
  if (typeof deal.duration_days !== 'number' || deal.duration_days <= 0) return '';
  return `${deal.duration_days} ${deal.duration_days === 1 ? 'day' : 'days'}`;
}

function blurb(deal: DealLike): string {
  return humanizeDashes((deal.short_description || deal.description || '').trim())
    .replace(/\s+/g, ' ')
    .slice(0, 220);
}

function navLinks(): string {
  return [
    '<nav aria-label="Primary">',
    '<a href="/deals">Tour deals</a> | <a href="/build-package">Build your own package</a> | <a href="/search">Search</a>',
    '</nav>',
  ].join('');
}

function dealListItem(deal: DealLike): string {
  const meta = [location(deal), duration(deal), price(deal.price)].filter(Boolean).join(' | ');
  const summary = blurb(deal);
  return [
    '<li>',
    `<a href="/deals/${escapeHtml(deal.slug)}">${text(deal.title)}</a>`,
    meta ? `<div>${escapeHtml(meta)}</div>` : '',
    summary ? `<p>${escapeHtml(summary)}</p>` : '',
    '</li>',
  ].join('');
}

function dealList(deals: DealLike[], limit: number): string {
  if (deals.length === 0) return '';
  return `<ul style="${LIST_STYLE}">${deals
    .slice(0, limit)
    .map(dealListItem)
    .join('')}</ul>`;
}

/** The homepage: the site's own words, then the deals that are currently featured. */
export function homeSkeleton(deals: DealLike[]): string {
  const meta = PAGE_META['/'];
  return [
    `<main style="${WRAP_STYLE}">`,
    `<h1>${escapeHtml(meta.title.split('|')[0].trim())}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    navLinks(),
    deals.length > 0 ? '<h2>Featured tour deals</h2>' : '',
    dealList(deals, HOME_DEAL_LIMIT),
    '</main>',
  ].join('');
}

/** The deals index: every active deal, linked, so the catalogue is crawlable. */
export function dealsSkeleton(deals: DealLike[]): string {
  const meta = PAGE_META['/deals'];
  return [
    `<main style="${WRAP_STYLE}">`,
    `<h1>${escapeHtml(meta.title.split('|')[0].trim())}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    deals.length > 0
      ? `<p>${deals.length} ${deals.length === 1 ? 'tour' : 'tours'} available right now.</p>`
      : '',
    dealList(deals, LIST_DEAL_LIMIT),
    '<p><a href="/build-package">Build a package around your own dates and budget</a></p>',
    '</main>',
  ].join('');
}

/** A route with no data of its own: its own heading and intro, then the way in. */
export function pageSkeleton(path: string): string {
  const meta = PAGE_META[path];
  if (!meta) return '';
  return [
    `<main style="${WRAP_STYLE}">`,
    `<h1>${escapeHtml(meta.title.split('|')[0].trim())}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    navLinks(),
    '</main>',
  ].join('');
}

/** A slug that is not an active deal: the same answer the app itself gives. */
export function notFoundSkeleton(): string {
  return [
    `<main style="${WRAP_STYLE}">`,
    '<h1>Deal not found</h1>',
    '<p>This tour is not available any more. <a href="/deals">Browse all tour deals</a>.</p>',
    '</main>',
  ].join('');
}

/** One deal: everything a visitor would read on the page, as plain markup. */
export function dealSkeleton(deal: DealLike): string {
  const facts = [location(deal), duration(deal), price(deal.price)].filter(Boolean);

  const itinerary = Array.isArray(deal.itinerary) ? deal.itinerary.slice(0, ITINERARY_LIMIT) : [];
  const phases = itinerary
    .map((phase, index) => {
      const heading = phase.title?.trim() || `Phase ${phase.phase ?? index + 1}`;
      const body = phase.description?.trim();
      return [
        '<li>',
        `<h3>${text(heading)}</h3>`,
        body ? `<p>${text(body)}</p>` : '',
        '</li>',
      ].join('');
    })
    .join('');

  const listBlock = (heading: string, items: string[] | null | undefined, limit: number) => {
    if (!Array.isArray(items) || items.length === 0) return '';
    return [
      `<h2>${escapeHtml(heading)}</h2>`,
      `<ul>${items
        .slice(0, limit)
        .map((item) => `<li>${text(item)}</li>`)
        .join('')}</ul>`,
    ].join('');
  };

  return [
    `<main style="${WRAP_STYLE}">`,
    '<article>',
    '<p><a href="/deals">All tour deals</a></p>',
    `<h1>${text(deal.title)}</h1>`,
    facts.length > 0 ? `<p>${escapeHtml(facts.join(' | '))}</p>` : '',
    deal.short_description ? `<p>${text(deal.short_description)}</p>` : '',
    deal.description ? `<p>${text(deal.description)}</p>` : '',
    phases ? `<h2>Itinerary</h2><ol style="${LIST_STYLE}">${phases}</ol>` : '',
    listBlock("What's included", deal.inclusions, 40),
    listBlock("What's not included", deal.exclusions, 40),
    '<p><a href="/build-package">Ask for this as a custom package</a></p>',
    '</article>',
    '</main>',
  ].join('');
}