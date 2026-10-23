import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { GeoapifyError, reverseGeocode, route, searchPlaces } from '../lib/geoapify';
import { geoCacheStats, purgeGeoCache, readThroughCache } from '../lib/geo-cache';
import { GeoReverseQuerySchema, GeoRouteQuerySchema, GeoSearchQuerySchema } from '../lib/validators';
import { Env } from '../types';

/**
 * Geoapify proxy.
 *
 * These three calls used to run in the browser with a key baked into the public
 * JS bundle. They now run here, so the key is a Worker secret and the client
 * only ever sees the app's own response shapes.
 *
 * Admin-only: the deal form is the sole consumer, public deal pages render the
 * route geometry that was saved with the deal and never geocode. Keeping it
 * behind auth means the Geoapify quota can't be drained by anonymous traffic.
 *
 * The handlers are exported so they can be exercised directly (without the auth
 * chain) against the real provider.
 */

/** Place data barely changes; a day is safe and removes almost all repeats. */
const SEARCH_TTL_SECONDS = 60 * 60;
/** Pin snapping asks for the same coordinates repeatedly. */
const REVERSE_TTL_SECONDS = 60 * 60 * 24;

const UPSTREAM_STATUS: ContentfulStatusCode[] = [400, 401, 402, 403, 404, 429, 500, 502, 503];

function toStatus(status: number): ContentfulStatusCode {
  return UPSTREAM_STATUS.includes(status as ContentfulStatusCode)
    ? (status as ContentfulStatusCode)
    : 502;
}

const NOT_CONFIGURED = 'Place search is not configured on the server (GEOAPIFY_API_KEY is missing).';

function requireKey(env: Env): string | null {
  return env.GEOAPIFY_API_KEY || null;
}

// Geocoding misses are normal (a bad pin can't be routed), so upstream failures
// are passed through with their original status: the admin form uses a non-2xx
// to decide which stops need snapping to the nearest road.
function handleError(c: Context, error: unknown) {
  if (error instanceof GeoapifyError) {
    return c.json({ error: error.message }, toStatus(error.status));
  }
  console.error('Geo proxy error:', error);
  return c.json({ error: 'Geo request failed' }, 502);
}

/** Collapses case/whitespace differences so "Dhaka" and " dhaka " share a slot. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Cache key on the worker's own origin, but a distinct path from any real request. */
function cacheKeyUrl(requestUrl: string, path: string, params: Record<string, string>): string {
  const url = new URL(`/__geo-cache${path}`, requestUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export async function handleSearch(c: Context) {
  const env = c.env as Env;
  const apiKey = requireKey(env);
  if (!apiKey) return c.json({ error: NOT_CONFIGURED }, 503);

  const parsed = GeoSearchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Invalid search query', details: parsed.error.issues }, 400);
  }

  const { q, limit } = parsed.data;
  // `refresh=1` bypasses the cached answer for a deliberate re-lookup.
  const refresh = c.req.query('refresh') === '1';

  try {
    const { value, source } = await readThroughCache(
      'search',
      cacheKeyUrl(c.req.url, '/search', { q: normalizeQuery(q), limit: String(limit) }),
      SEARCH_TTL_SECONDS,
      () => searchPlaces(q, limit, apiKey),
      { refresh },
    );
    return c.json({ places: value }, 200, { 'X-Geo-Cache': source });
  } catch (error) {
    return handleError(c, error);
  }
}

export async function handleReverse(c: Context) {
  const env = c.env as Env;
  const apiKey = requireKey(env);
  if (!apiKey) return c.json({ error: NOT_CONFIGURED }, 503);

  const parsed = GeoReverseQuerySchema.safeParse({
    lat: c.req.query('lat'),
    lon: c.req.query('lon'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Invalid coordinates', details: parsed.error.issues }, 400);
  }

  const { lat, lon } = parsed.data;
  const refresh = c.req.query('refresh') === '1';

  try {
    // Rounded to ~11m so pins dropped a few metres apart reuse one lookup. The
    // answer (the nearest address) is the same at that scale.
    const { value, source } = await readThroughCache(
      'reverse',
      cacheKeyUrl(c.req.url, '/reverse', { lat: lat.toFixed(4), lon: lon.toFixed(4) }),
      REVERSE_TTL_SECONDS,
      () => reverseGeocode(lat, lon, apiKey),
      { refresh },
    );
    return c.json({ place: value }, 200, { 'X-Geo-Cache': source });
  } catch (error) {
    return handleError(c, error);
  }
}

export async function handleRoute(c: Context) {
  const env = c.env as Env;
  const apiKey = requireKey(env);
  if (!apiKey) return c.json({ error: NOT_CONFIGURED }, 503);

  const parsed = GeoRouteQuerySchema.safeParse({
    waypoints: c.req.query('waypoints'),
    mode: c.req.query('mode'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Invalid waypoints', details: parsed.error.issues }, 400);
  }

  try {
    const result = await route(parsed.data.waypoints, parsed.data.mode, apiKey);
    if (!result.geometry) {
      // Upstream answered without usable geometry; treat it as unroutable so
      // the client's off-road recovery kicks in.
      return c.json({ error: 'No route found for those waypoints' }, 404);
    }
    return c.json(result);
  } catch (error) {
    return handleError(c, error);
  }
}

/**
 * Cache diagnostics. Deliberately public: it returns counters only, no queries,
 * no cached content, no credentials, and it has to be reachable by a plain
 * `curl` (or the browser) straight after a deploy to answer the one question a
 * cache change raises: is the edge cache actually working here?
 */
export async function handleCacheStats(c: Context) {
  return c.json(await geoCacheStats(c.req.url));
}

/**
 * Drops every cached lookup the serving isolate can reach, in both layers, so an
 * admin can force a fresh answer instead of waiting out the TTL. Admin-only: it
 * is a mutation, and it discards shared cache entries.
 */
export async function handleCachePurge(c: Context) {
  return c.json(await purgeGeoCache());
}

const geo = new Hono();

// Registered before the authed routes so it stays reachable without a token.
geo.get('/cache-stats', handleCacheStats);

geo.get('/search', authMiddleware, adminMiddleware, handleSearch);
geo.get('/reverse', authMiddleware, adminMiddleware, handleReverse);
geo.get('/route', authMiddleware, adminMiddleware, handleRoute);
geo.post('/cache-purge', authMiddleware, adminMiddleware, handleCachePurge);

export default geo;
