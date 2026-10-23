/**
 * The content version that retires the edge-rendered pages.
 *
 * The Pages Function caches its composed HTML under a key that includes this
 * value, so writing it is how an admin's change reaches the site's `<head>`,
 * Open Graph tags and sitemap immediately instead of after the page's TTL
 * (60 seconds for a deal page, 5 minutes for the rest).
 *
 * The namespace is optional on purpose. With no `CONTENT_VERSION_KV` bound the
 * Function falls back to time-bucketed keys, and this file is a no-op: pages
 * then refresh within one bucket instead of instantly, and nothing breaks.
 */
import type { Env } from '../types';

const VERSION_KEY = 'deals';

/**
 * Paths whose writes can change what a public page renders. Anything outside
 * these still works, it just waits for the page's TTL.
 */
const PUBLIC_CONTENT_SCOPES = [
  /^\/deals(?:\/|$)/,
  /^\/reviews(?:\/|$)/,
  /^\/upload(?:\/|$)/,
  /^\/admin\/package-/,
];

/** Whether this request's success invalidates the edge-rendered pages. */
export function affectsPublicContent(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  return PUBLIC_CONTENT_SCOPES.some((scope) => scope.test(path));
}

export async function bumpContentVersion(env: Env): Promise<void> {
  const kv = env.CONTENT_VERSION_KV;
  if (!kv) return;
  try {
    // A timestamp is enough: the value is only ever compared for equality with
    // the one the cached entry was stored under.
    await kv.put(VERSION_KEY, String(Date.now()));
  } catch (error) {
    console.warn('Content version bump failed:', error);
  }
}