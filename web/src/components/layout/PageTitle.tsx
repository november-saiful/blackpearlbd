import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_OG_IMAGE,
  PAGE_META,
  SITE_NAME,
  canonicalUrl,
  dealMeta,
  routeMeta,
  type DealLike,
  type SeoMeta,
} from '@/lib/seo';

/**
 * Head management for client-side navigation.
 *
 * Every public route is also composed at the edge (see `functions/[[path]].ts`),
 * which is what a crawler or a social scraper sees. This file exists for the
 * other half: a visitor who navigates within the app never triggers a document
 * load, so the tags have to be rewritten here. Both halves read the same strings
 * from `@/lib/seo`, so they cannot drift apart.
 */

const DEAL_PENDING_TITLE = 'Tour Deal | BlackPearl';

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector(selector);
  const element = (existing ?? document.createElement('meta')) as HTMLMetaElement;
  if (attribute === 'name') element.name = key;
  else element.setAttribute('property', key);
  element.content = content;
  if (!existing) document.head.appendChild(element);
}

function removeMeta(attribute: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function setTitle(value: string) {
  const existing = document.head.querySelector('title');
  const element = existing ?? document.createElement('title');
  element.textContent = value;
  if (!existing) document.head.appendChild(element);
}

function setCanonical(href: string) {
  document.head.querySelector('link[rel="canonical"]')?.remove();
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = href;
  document.head.appendChild(link);
}

/** Replace the structured data with this page's, so navigation never stacks two. */
function setJsonLd(nodes: SeoMeta['jsonLd']) {
  for (const stale of document.head.querySelectorAll('script[data-seo-jsonld]')) {
    stale.remove();
  }
  for (const node of nodes ?? []) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', '');
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...node });
    document.head.appendChild(script);
  }
}

/** Write the full set of tags for a page. `null` resets to the site defaults. */
function applyMeta(meta: SeoMeta | null) {
  const url = canonicalUrl(window.location.pathname);
  const image = meta?.image || DEFAULT_OG_IMAGE;

  setTitle(meta?.title || SITE_NAME);
  setCanonical(url);

  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:image', image);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:image', image);

  if (meta) {
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('property', 'og:type', meta.ogType);
  } else {
    removeMeta('name', 'description');
    removeMeta('property', 'og:description');
    removeMeta('name', 'twitter:description');
    removeMeta('property', 'og:title');
    removeMeta('name', 'twitter:title');
    removeMeta('property', 'og:type');
  }

  if (meta?.robots) upsertMeta('name', 'robots', meta.robots);
  else removeMeta('name', 'robots');

  setJsonLd(meta?.jsonLd);
}

/** Write the standard SEO head tags for the current public route. */
export function applyRouteMeta(meta: SeoMeta | null) {
  applyMeta(meta);
}

export function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = routeMeta(pathname);
    if (meta) {
      applyMeta(meta);
      return;
    }

    // Deal detail pages: the full tags land when the deal loads (applyDealMeta).
    // Until then this neutral set is written, so a stale deal's tags are never
    // left on screen.
    if (pathname.startsWith('/deals/')) {
      applyMeta({
        title: DEAL_PENDING_TITLE,
        description: PAGE_META['/deals'].description,
        path: pathname,
        ogType: 'product',
      });
      return;
    }

    // Everything else (404, auth callback, and so on): site defaults.
    applyMeta(null);
  }, [pathname]);

  return null;
}

/** Call from a deal detail page once the deal data is available. */
export function applyDealMeta(deal: DealLike) {
  applyMeta(dealMeta(deal));
}

/** Call from a deal detail page once the API has confirmed the deal is gone. */
export function applyDealNotFoundMeta() {
  applyMeta({
    title: `Tour deal not found | ${SITE_NAME}`,
    description: PAGE_META['/deals'].description,
    path: window.location.pathname,
    ogType: 'product',
    robots: 'noindex, follow',
  });
}