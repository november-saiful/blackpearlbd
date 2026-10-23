/**
 * Two-layer read-through cache for the /geo proxy.
 *
 * Layer 1: isolate memory. Each Worker isolate serves many requests for the
 * duration of its life, and the repeated calls all come from one admin iterating
 * on a deal: a search retyped with different spacing, or the same pin reverse
 * geocoded again while snapping a route.
 *
 * Layer 2: Cloudflare's edge cache (`caches.default`), shared across all
 * requests hitting the same data centre. Note this layer is only functional when
 * the Worker is served from a **custom domain**: on `*.workers.dev` cache
 * operations are documented no-ops, which is why layer 1 carries the load there.
 * Every edge call is wrapped so an inoperative or failing cache simply means a
 * miss, never a failed request.
 *
 * Routing responses are deliberately not cached: a polyline for the Dhaka →
 * Cox's Bazar leg measured ~3000 coordinates, and every distinct waypoint set is
 * one entry. They would displace far more valuable entries from layer 1 and rarely
 * repeat.
 */

const MEMO_LIMIT = 500;

const memo = new Map<string, { expiresAt: number; value: unknown }>();

export type GeoCacheSource = 'isolate' | 'edge' | 'origin';

/** The cached endpoints. `route` is absent: routing responses are not cached. */
export type GeoCacheNamespace = 'search' | 'reverse';

interface CounterSet {
  requests: number;
  isolateHits: number;
  edgeHits: number;
  misses: number;
}

const counters = new Map<GeoCacheNamespace, CounterSet>();

/**
 * Start of this isolate's geo activity.
 *
 * Deliberately NOT `Date.now()` at module scope: Workers freezes it during
 * module evaluation and returns 0 until the first I/O, which reported a
 * 56-year uptime in production. Claiming a start time from inside a request is
 * accurate and costs nothing.
 */
let isolateStartedAt: number | null = null;

function markIsolateStart() {
  if (isolateStartedAt === null) isolateStartedAt = Date.now();
}

/** Maintenance activity, surfaced by /geo/cache-stats. */
const maintenance = {
  refreshes: 0,
  purges: 0,
  lastPurgeAt: null as string | null,
  lastPurgedKeys: 0,
};

/** Bound the work one purge can do in a single request. */
const PURGE_KEY_LIMIT = 100;

function counterFor(namespace: GeoCacheNamespace): CounterSet {
  let entry = counters.get(namespace);
  if (!entry) {
    entry = { requests: 0, isolateHits: 0, edgeHits: 0, misses: 0 };
    counters.set(namespace, entry);
  }
  return entry;
}

function memoGet<T>(key: string): T | undefined {
  const entry = memo.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memo.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function memoSet(key: string, value: unknown, ttlSeconds: number) {
  if (memo.size >= MEMO_LIMIT) {
    // Map iterates in insertion order, so the first key is the oldest entry.
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value });
}

/**
 * `caches.default` is the Cloudflare-specific default cache. It is missing
 * outside the Workers runtime (local scripts) and its typings live outside the
 * standard CacheStorage interface, hence the cast.
 */
function edgeCache(): Cache | null {
  try {
    if (typeof caches === 'undefined') return null;
    return (caches as unknown as { default?: Cache }).default ?? null;
  } catch {
    return null;
  }
}

async function edgeGet<T>(key: Request): Promise<T | undefined> {
  const cache = edgeCache();
  if (!cache) return undefined;
  try {
    const hit = await cache.match(key);
    if (!hit) return undefined;
    return (await hit.json()) as T;
  } catch (error) {
    console.warn('Geo edge cache read failed:', error);
    return undefined;
  }
}

async function edgePut(key: Request, value: unknown, ttlSeconds: number) {
  const cache = edgeCache();
  if (!cache) return;
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(value), {
        headers: {
          'content-type': 'application/json',
          // cache.put() takes the TTL from the response's Cache-Control.
          'cache-control': `public, max-age=${ttlSeconds}`,
        },
      }),
    );
  } catch (error) {
    console.warn('Geo edge cache write failed:', error);
  }
}

/**
 * Returns the cached value for `keyUrl` if there is one, otherwise runs
 * `produce` and stores the result in both layers. The source is reported back so
 * routes can expose it as `X-Geo-Cache` and a hit rate can be confirmed from the
 * network tab.
 */
export async function readThroughCache<T>(
  namespace: GeoCacheNamespace,
  keyUrl: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
  options: { refresh?: boolean } = {},
): Promise<{ value: T; source: GeoCacheSource }> {
  markIsolateStart();
  const counter = counterFor(namespace);
  counter.requests += 1;

  const key = new Request(keyUrl, { method: 'GET' });

  // A "refresh" is a deliberate bypass: the caller wants the current upstream
  // answer even if a cached one exists. The fresh value is written back over
  // both layers, so the stale entry is replaced rather than left behind.
  if (options.refresh) {
    maintenance.refreshes += 1;
    counter.misses += 1;
    const value = await produce();
    memoSet(keyUrl, value, ttlSeconds);
    await edgePut(key, value, ttlSeconds);
    return { value, source: 'origin' };
  }

  const fromMemo = memoGet<T>(keyUrl);
  if (fromMemo !== undefined) {
    counter.isolateHits += 1;
    return { value: fromMemo, source: 'isolate' };
  }

  // A key without request headers, so two admins (and two sessions) share one
  // entry instead of caching per Authorization token.
  const fromEdge = await edgeGet<T>(key);
  if (fromEdge !== undefined) {
    counter.edgeHits += 1;
    memoSet(keyUrl, fromEdge, ttlSeconds);
    return { value: fromEdge, source: 'edge' };
  }

  counter.misses += 1;
  const value = await produce();
  memoSet(keyUrl, value, ttlSeconds);
  await edgePut(key, value, ttlSeconds);
  return { value, source: 'origin' };
}

export interface GeoCachePurgeResult {
  isolateEntriesCleared: number;
  edgeKeysAttempted: number;
  edgeEntriesDeleted: number;
  /** True when more entries existed than a single purge will process. */
  truncated: boolean;
  edgeCacheAvailable: boolean;
  note: string;
}

/**
 * Drop every cached lookup this isolate knows about, from both layers.
 *
 * The isolate's memo holds the cache keys themselves, which is what makes the
 * edge half possible at all: the Cache API has no way to list or pattern-match
 * keys, so an entry can only be deleted if its key is known. Entries cached by
 * *other* isolates are therefore unreachable from here and age out with their
 * TTL: acceptable because the TTLs are short (1h / 24h) and a fresh answer is
 * written back by the next lookup.
 */
export async function purgeGeoCache(): Promise<GeoCachePurgeResult> {
  const keys = [...memo.keys()];
  const targets = keys.slice(0, PURGE_KEY_LIMIT);
  memo.clear();

  maintenance.purges += 1;
  maintenance.lastPurgeAt = new Date().toISOString();
  maintenance.lastPurgedKeys = targets.length;

  const cache = edgeCache();
  let deleted = 0;

  if (cache) {
    for (const keyUrl of targets) {
      try {
        if (await cache.delete(new Request(keyUrl, { method: 'GET' }))) deleted += 1;
      } catch (error) {
        console.warn('Geo edge cache delete failed:', error);
      }
    }
  }

  return {
    isolateEntriesCleared: targets.length,
    edgeKeysAttempted: cache ? targets.length : 0,
    edgeEntriesDeleted: deleted,
    truncated: keys.length > targets.length,
    edgeCacheAvailable: cache !== null,
    note: cache
      ? 'Edge entries were deleted by key. Entries cached in other data centres or isolates are not addressable and expire on their own.'
      : 'The edge cache is unavailable on this host (Cache API is a no-op on *.workers.dev), so only in-memory entries were cleared.',
  };
}

const PROBE_TTL_SECONDS = 60;
let probeRuns = 0;

interface EdgeProbe {
  /**
   * A canary written by an *earlier request* was readable here. This is the only
   * trustworthy signal: a put+match inside one request proves nothing, because
   * the cache can serve a same-request write from a local buffer even when
   * nothing is persisted. A probe that only checks within one request reports a
   * healthy cache on a host where caching does nothing, which is exactly the
   * false positive this probe used to produce.
   */
  persistedAcrossRequests: boolean;
  /** The write was accepted and readable immediately (necessary, not sufficient). */
  writableInRequest: boolean;
  canaryWrittenAt: string | null;
  canaryAgeSeconds: number | null;
  verdict: 'active' | 'not-persisting' | 'unavailable' | 'unknown-first-probe';
}

async function probeEdgeCache(originUrl: string): Promise<EdgeProbe> {
  const firstProbe = probeRuns === 0;
  probeRuns += 1;

  const cache = edgeCache();
  if (!cache) {
    return {
      persistedAcrossRequests: false,
      writableInRequest: false,
      canaryWrittenAt: null,
      canaryAgeSeconds: null,
      verdict: 'unavailable',
    };
  }

  const key = new Request(new URL('/__geo-cache/__probe', originUrl).toString(), { method: 'GET' });
  let previous: { writtenAt?: string } | null = null;

  try {
    const hit = await cache.match(key);
    if (hit) previous = (await hit.json()) as { writtenAt?: string };
  } catch (error) {
    console.warn('Geo edge cache probe read failed:', error);
  }

  // Leave a canary for whichever request comes next, wherever it lands.
  const writtenAt = new Date().toISOString();
  let writableInRequest = false;
  try {
    await cache.put(
      key,
      new Response(JSON.stringify({ token: crypto.randomUUID(), writtenAt }), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${PROBE_TTL_SECONDS}` },
      }),
    );
    writableInRequest = (await cache.match(key)) !== undefined;
  } catch (error) {
    console.warn('Geo edge cache probe write failed:', error);
  }

  const canaryWrittenAt = previous?.writtenAt ?? null;
  const persisted = canaryWrittenAt !== null;

  return {
    persistedAcrossRequests: persisted,
    writableInRequest,
    canaryWrittenAt,
    canaryAgeSeconds: canaryWrittenAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(canaryWrittenAt)) / 1000))
      : null,
    verdict: persisted
      ? 'active'
      : firstProbe
        ? 'unknown-first-probe'
        : 'not-persisting',
  };
}

export interface GeoCacheStatsSnapshot {
  hostname: string;
  /** True when the request was served from a domain other than *.workers.dev. */
  customDomain: boolean;
  uptimeSeconds: number;
  isolate: { entries: number; limit: number; startedAt: string | null };
  edge: EdgeProbe & { capable: boolean };
  totals: CounterSet & { savedUpstreamCalls: number };
  byNamespace: Record<string, CounterSet>;
  maintenance: { refreshes: number; purges: number; lastPurgeAt: string | null; lastPurgedKeys: number };
  note: string;
}

/**
 * Counters are per isolate, so this describes the isolate that answered: treat
 * it as a live sample, not a fleet-wide total.
 */
export async function geoCacheStats(requestUrl: string): Promise<GeoCacheStatsSnapshot> {
  markIsolateStart();
  const { hostname } = new URL(requestUrl);

  const totals: CounterSet = { requests: 0, isolateHits: 0, edgeHits: 0, misses: 0 };
  const byNamespace: Record<string, CounterSet> = {};

  for (const [namespace, count] of counters) {
    byNamespace[namespace] = { ...count };
    totals.requests += count.requests;
    totals.isolateHits += count.isolateHits;
    totals.edgeHits += count.edgeHits;
    totals.misses += count.misses;
  }

  return {
    hostname,
    customDomain: !hostname.endsWith('.workers.dev'),
    uptimeSeconds: isolateStartedAt === null ? 0 : Math.round((Date.now() - isolateStartedAt) / 1000),
    isolate: {
      entries: memo.size,
      limit: MEMO_LIMIT,
      startedAt: isolateStartedAt === null ? null : new Date(isolateStartedAt).toISOString(),
    },
    edge: { capable: edgeCache() !== null, ...(await probeEdgeCache(requestUrl)) },
    totals: { ...totals, savedUpstreamCalls: totals.isolateHits + totals.edgeHits },
    byNamespace,
    maintenance: { ...maintenance },
    note:
      'Counters describe the isolate that answered, not the fleet. For the edge cache, trust edge.verdict: it is only "active" when a canary written by an earlier request was read back, since a same-request put/match succeeds even where caching does nothing.',
  };
}
