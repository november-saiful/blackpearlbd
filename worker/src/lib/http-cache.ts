/**
 * Generic two-layer read-through cache for public Worker responses.
 *
 * This file was missing (deals.ts imported it but it was never committed),
 * which broke `tsc --noEmit` and all Worker deploys. Minimal implementation:
 * isolate memory (works everywhere) + `caches.default` edge (works on custom
 * domains, documented no-op on *.workers.dev — wrapped so it never throws).
 */

export interface CachePolicy {
  maxAgeSeconds: number;
  public?: boolean;
  mustRevalidate?: boolean;
  vary?: string[];
}

export type HttpCacheSource = 'isolate' | 'edge' | 'origin';

const memo = new Map<string, { expiresAt: number; value: unknown }>();
const MEMO_LIMIT = 500;

function memoGet<T>(key: string): T | undefined {
  const entry = memo.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memo.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function memoSet(key: string, value: unknown, ttlSeconds: number): void {
  if (memo.size >= MEMO_LIMIT) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value });
}

function cacheKey(key: string): Request {
  return new Request(`https://cache.internal/${key}`, { method: 'GET' });
}

async function edgeGet<T>(req: Request): Promise<T | undefined> {
  try {
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(req);
    if (!hit) return undefined;
    return (await hit.json()) as T;
  } catch {
    return undefined;
  }
}

async function edgePut(req: Request, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const cache = (caches as unknown as { default: Cache }).default;
    await cache.put(
      req,
      new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}`,
        },
      }),
    );
  } catch {
    // Edge cache unavailable (e.g. *.workers.dev) — isolate layer still works.
  }
}

/**
 * Returns the cached value for `key` if fresh, otherwise runs `produce` and
 * stores the result in both layers. `req` is accepted for API compatibility
 * (Vary support) and future keying — the current keying is by `key`.
 */
export async function readThroughCache<T>(
  key: string,
  _req: Request,
  policy: CachePolicy,
  produce: () => Promise<T>,
): Promise<{ value: T; source: HttpCacheSource }> {
  const ttl = policy.maxAgeSeconds;
  const req = cacheKey(key);

  const fromMemo = memoGet<T>(key);
  if (fromMemo !== undefined) return { value: fromMemo, source: 'isolate' };

  const fromEdge = await edgeGet<T>(req);
  if (fromEdge !== undefined) {
    memoSet(key, fromEdge, ttl);
    return { value: fromEdge, source: 'edge' };
  }

  const value = await produce();
  memoSet(key, value, ttl);
  await edgePut(req, value, ttl);
  return { value, source: 'origin' };
}
