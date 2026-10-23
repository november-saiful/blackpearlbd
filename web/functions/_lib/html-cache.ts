/**
 * Edge cache for composed HTML, plus the version key that retires it.
 *
 * Same shape and same failure posture as the Worker's `lib/http-cache.ts`: the
 * cache is an optimisation, never a dependency, so every operation is guarded
 * and a miss, a failure, or an absent runtime just means "render it again".
 *
 * One difference from the Worker's version: the key carries a content version,
 * so a write can retire every page at once without knowing which URLs exist.
 * The version comes from KV when a namespace is bound (the Worker bumps it on
 * every deal write). Without KV it is the current time bucket, which self-heals
 * every bucket and can never serve yesterday's HTML.
 */
import type { PagesEnv } from './types';

export interface HtmlCachePolicy {
  /** How long an entry stays usable, in seconds. */
  maxAgeSeconds: number;
}

export type HtmlCacheSource = 'edge' | 'render';

/** A composed page. The status travels with it so a 404 can be cached as a 404. */
export interface RenderedPage {
  html: string;
  status: number;
}

const STATUS_HEADER = 'x-seo-status';

/** How long a time-bucketed version lasts when no KV namespace is bound. */
const VERSION_BUCKET_SECONDS = 60;

function edgeCache(): Cache | null {
  try {
    if (typeof caches === 'undefined') return null;
    return (caches as unknown as { default?: Cache }).default ?? null;
  } catch {
    return null;
  }
}

/**
 * The current content version. Read from KV when bound, so a deal write can
 * bump it and retire every cached page at once; otherwise bucketed by the clock
 * at {@link VERSION_BUCKET_SECONDS}, which needs no configuration and caps how
 * stale a page can be at one bucket.
 */
export async function contentVersion(env: PagesEnv): Promise<string> {
  const kv = env.CONTENT_VERSION_KV;
  if (kv && typeof kv.get === 'function') {
    try {
      const value = await kv.get('deals');
      if (value) return value;
    } catch (error) {
      console.warn('SEO edge: content version read failed:', error);
    }
  }
  return String(Math.floor(Date.now() / (VERSION_BUCKET_SECONDS * 1000)));
}

/**
 * The cache key for a path. The request's own query string is dropped and the
 * version is added: HTML is composed from the path alone (the SPA reads query
 * parameters after it boots), so one entry per path serves every spelling of the
 * same page, and the version is what retires the entry.
 */
export function htmlCacheKey(request: Request, version: string): Request {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}?__seo_v=${encodeURIComponent(version)}`, {
    method: 'GET',
  });
}

/** The cached page for `key`, or freshly rendered HTML. */
export async function readThroughHtml(
  key: Request,
  policy: HtmlCachePolicy,
  render: () => Promise<RenderedPage>,
): Promise<RenderedPage & { source: HtmlCacheSource }> {
  const cache = edgeCache();
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const status = Number(hit.headers.get(STATUS_HEADER)) || 200;
        return { html: await hit.text(), status, source: 'edge' };
      }
    } catch (error) {
      console.warn('SEO edge: cache read failed:', error);
    }
  }

  const page = await render();

  if (cache) {
    try {
      // cache.put() takes its TTL from the response's Cache-Control.
      await cache.put(
        key,
        new Response(page.html, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': `public, max-age=${policy.maxAgeSeconds}`,
            [STATUS_HEADER]: String(page.status),
          },
        }),
      );
    } catch (error) {
      console.warn('SEO edge: cache write failed:', error);
    }
  }

  return { ...page, source: 'render' };
}