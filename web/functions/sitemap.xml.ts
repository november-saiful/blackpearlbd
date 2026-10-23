/**
 * `/sitemap.xml`, generated from the live catalogue.
 *
 * A static sitemap can only list the deals that existed when it was written, so
 * a newly published deal waits for someone to remember to edit it. This one is
 * built from the same public endpoint the site reads, so a new deal appears in
 * the sitemap as soon as its page does, and a retired one stops being advertised
 * at the same time.
 *
 * Served from the edge cache under the same content version as the pages, so a
 * deal write (or, without KV, the next bucket) refreshes both together.
 */
import { canonicalUrl, escapeHtml } from '../src/lib/seo';
import { fetchDeals, resolveApiOrigin } from './_lib/api';
import { contentVersion, htmlCacheKey, readThroughHtml } from './_lib/html-cache';
import { loadShell } from './_lib/shell';
import type { PagesContext } from './_lib/types';

const CACHE_SECONDS = 300;

const STATIC_ROUTES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/deals', changefreq: 'daily', priority: '0.9' },
  { path: '/build-package', changefreq: 'monthly', priority: '0.7' },
  { path: '/search', changefreq: 'monthly', priority: '0.3' },
];

/** `2026-04-01T09:15:00.000Z` becomes `2026-04-01`, the only form a sitemap takes. */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function urlEntry(loc: string, lastmod?: string | null, changefreq?: string, priority?: string): string {
  return [
    '  <url>',
    `    <loc>${escapeHtml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderSitemap(deals: Awaited<ReturnType<typeof fetchDeals>>): string {
  const entries = STATIC_ROUTES.map((route) =>
    urlEntry(canonicalUrl(route.path), null, route.changefreq, route.priority),
  );

  for (const deal of deals ?? []) {
    entries.push(urlEntry(canonicalUrl(`/deals/${deal.slug}`), isoDate(deal.updated_at), 'weekly', '0.8'));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join('\n'),
    '</urlset>',
    '',
  ].join('\n');
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);

  const shell = await loadShell(env, url);
  const origin = shell ? resolveApiOrigin(env, shell) : null;
  const version = await contentVersion(env);

  const page = await readThroughHtml(htmlCacheKey(request, version), { maxAgeSeconds: CACHE_SECONDS }, async () => {
    const deals = origin ? await fetchDeals(origin) : null;
    return { html: renderSitemap(deals), status: 200 };
  });

  return new Response(page.html, {
    status: page.status,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'x-seo-cache': page.source,
    },
  });
};