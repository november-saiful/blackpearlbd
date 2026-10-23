/**
 * Naming the photo a page is judged on before its JavaScript has run.
 *
 * A deal photo is roughly 200 KB, and a single-page app cannot ask for one until
 * it has downloaded, parsed and run the code that knows the URL. On a phone
 * connection that is three seconds of the browser never hearing about the
 * largest thing on the screen. The listing pages are composed here anyway, from
 * the same cached catalogue the browser then fetches, so the edge can put the
 * photo in the head and let the parser start it beside the stylesheet.
 *
 * Only for pages whose largest painted element IS a photo. The home page paints
 * its headline first, so preloading there trades a text paint for an image byte
 * and measures slower: the preload costs the JavaScript that renders the words.
 *
 * Which deal leads the grid follows the app, and the query string cannot be part
 * of the answer: the edge cache keys on the path alone, so a filtered view and a
 * plain visit are served one page. A filtered link may therefore spend the byte
 * twice, which the newest-first default view, the one almost every visitor sees,
 * does not.
 */
import type { DealLike } from '../../src/lib/seo';

/** Quotes an attribute value, in the same narrow way the head tags do. */
function attribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function photoOf(deal: DealLike | undefined): string | null {
  const url = deal?.image_url;
  return typeof url === 'string' && url ? url : null;
}

/**
 * The preload tag for one photo, or nothing when there is no photo to name.
 * `fetchpriority=high` because the byte is what the page will be measured on, and
 * an unprioritised image queues behind the fonts and the route's own JavaScript.
 */
export function imagePreload(photo: string | null): string {
  if (!photo) return '';
  return `<link rel="preload" as="image" fetchpriority="high" href="${attribute(photo)}" />`;
}

/** The grid's lead: the catalogue keeps its newest deal at the top. */
export function leadPhotoPreload(deals: DealLike[]): string {
  return imagePreload(photoOf(deals[0]));
}
