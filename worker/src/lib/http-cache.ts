/**
 * Two-layer read-through cache for public, read-only Worker responses.
 *
 * A generalisation of `geo-cache.ts` for route data (deals lists, single deals,
 * related-deal slices) rather than upstream Geoapify lookups. Same two layers,
 * same failure posture:
 *
 * Layer 1: isolate memory. Cheap, always available, bounded, and lost when the
 * isolate is evicted.
 *
 * Layer 2: Cloudflare's edge cache (`caches.default`), shared across requests
 * reaching the same data centre. Only functional on a **custom domain**: on
 * `*.workers.dev` cache operations are documented no-ops that silently succeed,
 * so layer 1 carries the whole load there. Every edge call is wrapped so an
 * inoperative or failing cache degrades to a miss and never fails a request.
 *
 * A `produce` that throws is not cached, the error propagates to Hono, and the
 * next request tries the origin again rather than pinning a failure for the TTL.
 */

const MEMO_LIMIT = 500;

const memo = new Map<string, { expiresAt: number; value: unknown }>();

export type HttpCacheSource = 'isolate' | 'edge' | 'origin';

export interface CachePolicy {
  /** How long the entry stays usable, in seconds. Also the edge `max-age`. */
  maxAgeSeconds: number;
  /** Shared caches may store the response; false means private. */
  public?: boolean;
  /** Require revalidation with the origin once the entry goes stale. */
  mustRevalidate?: boolean;
  /**
   * Header names the route advertises in its `Vary` response.
   *
   * Deliberately NOT folded into the cache key. These routes build their
   * response from a service-role client and return identical bytes for every
   * caller, so keying on `Authorization` would give each session its own entry
   * and the cache would effectively never hit. The policy field exists so the
   * route can emit an honest `Vary` to any intermediary in front of it.
   */
  vary?: string[];
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
  if (memo.size >= MEMO_LIMIT && !memo.has(key)) {
    // Map iterates in insertion order, so the first key is the oldest entry.
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value });
}

/**
 * `caches.default` is Cloudflare-specific and missing outside the Workers
 * runtime (local scripts, unit tests), hence the guarded cast.
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
    console.warn('HTTP edge cache read failed:', error);
    return undefined;
  }
}

async function edgePut(key: Request, value: unknown, policy: CachePolicy) {
  const cache = edgeCache();
  if (!cache) return;
  const directives = [
    policy.public === false ? 'private' : 'public',
    `max-age=${policy.maxAgeSeconds}`,
  ];
  if (policy.mustRevalidate) directives.push('must-revalidate');
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(value), {
        headers: {
          'content-type': 'application/json',
          // cache.put() takes the TTL from the response's Cache-Control.
          'cache-control': directives.join(', '),
        },
      }),
    );
  } catch (error) {
    console.warn('HTTP edge cache write failed:', error);
  }
}

/**
 * Return the cached value for `namespace` + request URL, or run `produce` and
 * store the result in both layers.
 *
 * `source` is reported back so routes can surface it (they expose it as
 * `X-Geo-Cache`) and a hit can be confirmed from the network tab.
 */
export async function readThroughCache<T>(
  namespace: string,
  request: Request,
  policy: CachePolicy,
  produce: () => Promise<T>,
): Promise<{ value: T; source: HttpCacheSource }> {
  const memoKey = `${namespace}\n${request.url}`;
  // Headers are excluded so concurrent visitors share one entry.
  const edgeKey = new Request(request.url, { method: 'GET' });

  const fromMemo = memoGet<T>(memoKey);
  if (fromMemo !== undefined) {
    return { value: fromMemo, source: 'isolate' };
  }

  const fromEdge = await edgeGet<T>(edgeKey);
  if (fromEdge !== undefined) {
    memoSet(memoKey, fromEdge, policy.maxAgeSeconds);
    return { value: fromEdge, source: 'edge' };
  }

  const value = await produce();
  memoSet(memoKey, value, policy.maxAgeSeconds);
  await edgePut(edgeKey, value, policy);
  return { value, source: 'origin' };
}
