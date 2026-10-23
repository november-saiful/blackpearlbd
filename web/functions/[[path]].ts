/**
 * Edge-rendered pages.
 *
 * The site is a single-page app, so the HTML Cloudflare Pages would serve is the
 * same empty shell for every route: no title, no description, no canonical, no
 * preview image and no body copy for a crawler to read. This function composes
 * the page at the origin instead, per route, before the browser or a bot ever
 * sees it:
 *
 *   - the route's own title, description, canonical, robots and Open Graph tags
 *   - JSON-LD structured data (Organization/WebSite, Product/Offer, breadcrumbs)
 *   - a crawlable body inside `<div id="root">`, which React replaces on first
 *     commit (createRoot clears the container, so there is nothing to reconcile)
 *
 * Deal routes take their data from the API Worker's already-cached public
 * endpoints, which is why no Supabase credential is needed here.
 *
 * Requests are only intercepted when the answer is HTML the SPA owns. Anything
 * with a file extension goes straight to the static pipeline with `next()`, so
 * asset caching in `_headers`, the `/assets/404.html` guard and the SPA rewrite
 * in `_redirects` all keep working exactly as before.
 */
import {
  PAGE_META,
  SITE_NAME,
  dealListJsonLd,
  dealMeta,
  normalizePath,
  renderHead,
  renderJsonLd,
  routeMeta,
  type SeoMeta,
} from '../src/lib/seo';
import { fetchDeal, fetchDeals, resolveApiOrigin } from './_lib/api';
import { contentVersion, htmlCacheKey, readThroughHtml, type RenderedPage } from './_lib/html-cache';
import { composePage } from './_lib/inject';
import { loadShell } from './_lib/shell';
import { dealSkeleton, dealsSkeleton, homeSkeleton, notFoundSkeleton, pageSkeleton } from './_lib/skeleton';
import type { PagesContext } from './_lib/types';

/** How long a non-deal page stays cached at the edge. */
const PAGE_CACHE_SECONDS = 300;
/** How long a deal page stays cached: short enough that a retired or repriced deal lands quickly. */
const DEAL_CACHE_SECONDS = 60;

/** A last path segment with a dot is a file, not a route. */
const FILE_EXTENSION = /\.[a-z0-9]+$/i;

/** Routes whose content the app owns and this function should compose. */
type RouteKind = 'home' | 'deals' | 'deal' | 'page' | 'private' | 'static';

export function classify(pathname: string): RouteKind {
  if (pathname === '/') return 'home';
  if (pathname === '/deals') return 'deals';
  if (pathname.startsWith('/deals/')) return 'deal';
  if (pathname === '/build-package' || pathname === '/search') return 'page';
  if (/^\/(?:admin|profile|auth)(?:\/|$)/.test(pathname)) return 'private';
  return 'static';
}

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

function metaWithData(meta: SeoMeta, extraJsonLd: Array<Record<string, unknown>> = []): string {
  const jsonLd = [...(meta.jsonLd ?? []), ...extraJsonLd];
  return [renderHead(meta), renderJsonLd(jsonLd)].filter(Boolean).join('\n    ');
}

/** Metadata for a deal route whose record could not be read. */
function pendingDealMeta(pathname: string, missing = false): SeoMeta {
  return {
    title: missing ? `Tour deal not found | ${SITE_NAME}` : `Tour Deal | ${SITE_NAME}`,
    description: PAGE_META['/deals'].description,
    path: pathname,
    ogType: 'product',
    robots: missing ? 'noindex, follow' : null,
  };
}

async function renderRoute(
  kind: RouteKind,
  pathname: string,
  shell: string,
  env: PagesContext['env'],
): Promise<RenderedPage> {
  const origin = resolveApiOrigin(env, shell);

  if (kind === 'deal') {
    const slug = decodeSlug(pathname.slice('/deals/'.length));
    if (!slug || !origin) {
      return { html: composePage(shell, metaWithData(pendingDealMeta(pathname)), ''), status: 200 };
    }

    const { deal, missing, failed } = await fetchDeal(origin, slug);
    if (missing) {
      return {
        html: composePage(shell, metaWithData(pendingDealMeta(pathname, true)), notFoundSkeleton()),
        status: 404,
      };
    }
    if (failed || !deal) {
      return { html: composePage(shell, metaWithData(pendingDealMeta(pathname)), ''), status: 200 };
    }

    const meta = dealMeta(deal);
    return { html: composePage(shell, metaWithData(meta), dealSkeleton(deal)), status: 200 };
  }

  const base = routeMeta(pathname);
  if (!base) return { html: shell, status: 200 };

  // The two listing pages also carry the catalogue, as body copy and as an
  // ItemList, so a crawler reaches every deal from the page that lists them.
  const deals = origin ? ((await fetchDeals(origin)) ?? []) : [];
  const skeleton =
    kind === 'home' ? homeSkeleton(deals) : kind === 'deals' ? dealsSkeleton(deals) : pageSkeleton(pathname);

  return { html: composePage(shell, metaWithData(base, dealListJsonLd(deals)), skeleton), status: 200 };
}

function respond(page: RenderedPage, source: string, cacheControl: string): Response {
  return new Response(page.html, {
    status: page.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cacheControl,
      'x-seo-cache': source,
    },
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env, next } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);

  if (FILE_EXTENSION.test(pathname)) return next();

  const kind = classify(pathname);
  if (kind === 'static') return next();

  const shell = await loadShell(env, url);
  if (!shell) return next();

  // Signed-in and dashboard surfaces are served as the app and kept out of the
  // index, in case a URL to one is ever shared. Never cached: nothing here is
  // shared between visitors.
  if (kind === 'private') {
    const meta: SeoMeta = {
      title: SITE_NAME,
      description: PAGE_META['/'].description,
      path: pathname,
      ogType: 'website',
      robots: 'noindex, nofollow',
    };
    return respond(
      { html: composePage(shell, metaWithData(meta), ''), status: 200 },
      'none',
      'private, no-store',
    );
  }

  const version = await contentVersion(env);
  const policy = { maxAgeSeconds: kind === 'deal' ? DEAL_CACHE_SECONDS : PAGE_CACHE_SECONDS };

  const page = await readThroughHtml(htmlCacheKey(request, version), policy, () =>
    renderRoute(kind, pathname, shell, env),
  );

  // Browsers revalidate every time (the shell's asset URLs change with a deploy);
  // the edge cache above is what makes the page instant to serve.
  return respond(page, page.source, 'public, max-age=0, must-revalidate');
};