/**
 * Reads the live catalogue from the API Worker.
 *
 * The deal endpoints are public and read-through cached on the Worker side, so
 * a deal page costs the edge one short round trip and never touches Supabase
 * directly. No credentials live in this project's Pages environment because of
 * it: the Worker holds the service-role key, the edge just asks it questions.
 */
import type { DealLike } from '../../src/lib/seo';
import type { PagesEnv } from './types';

const ABSOLUTE_URL = /^https?:\/\/[^/\s]+/i;
const SHELL_ORIGIN = /<meta\s+name="x-api-origin"\s+content="([^"]*)"/i;
const REQUEST_TIMEOUT_MS = 4000;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function asOrigin(value: string | undefined | null): string | null {
  const trimmed = (value || '').trim();
  return ABSOLUTE_URL.test(trimmed) ? stripTrailingSlash(trimmed) : null;
}

/**
 * The API origin, in order of preference:
 *
 *   1. `API_ORIGIN`, for when the edge must reach an origin the browser does not.
 *   2. The origin baked into the app shell from `VITE_API_URL` at build time,
 *      which is the same one every visitor's browser already calls.
 *
 * Null when neither is set, and the caller then renders the page without deal
 * data rather than guessing at a host.
 */
export function resolveApiOrigin(env: PagesEnv, shellHtml: string): string | null {
  const configured = asOrigin(typeof env.API_ORIGIN === 'string' ? env.API_ORIGIN : null);
  if (configured) return configured;
  return asOrigin(shellHtml.match(SHELL_ORIGIN)?.[1] ?? null);
}

interface JsonResult {
  status: number;
  body: unknown;
}

async function getJson(url: string): Promise<JsonResult | null> {
  try {
    // `AbortSignal.timeout` may be absent in an older runtime, so it is reached
    // through a cast rather than assumed present.
    const withTimeout = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
    const signal =
      typeof withTimeout.timeout === 'function' ? withTimeout.timeout(REQUEST_TIMEOUT_MS) : undefined;
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (error) {
    // A slow or unreachable API must not fail the page: the shell still renders,
    // it just carries the route's own metadata instead of the record's.
    console.warn('SEO edge: API request failed:', url, error);
    return null;
  }
}

function asDeal(value: unknown): DealLike | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as DealLike;
  return typeof candidate.title === 'string' && typeof candidate.slug === 'string' ? candidate : null;
}

/** Every active deal, or null when the catalogue could not be read. */
export async function fetchDeals(origin: string): Promise<DealLike[] | null> {
  const result = await getJson(`${origin}/deals`);
  if (!result || result.status !== 200) return null;
  const list = (result.body as { deals?: unknown })?.deals;
  if (!Array.isArray(list)) return null;
  return list.map(asDeal).filter((deal): deal is DealLike => deal !== null);
}

export interface DealFetch {
  deal: DealLike | null;
  /** The API answered, and this slug is not an active deal. */
  missing: boolean;
  /** The API could not be reached or answered with a failure. */
  failed: boolean;
}

export async function fetchDeal(origin: string, slug: string): Promise<DealFetch> {
  const result = await getJson(`${origin}/deals/${encodeURIComponent(slug)}`);
  if (!result) return { deal: null, missing: false, failed: true };
  if (result.status === 404) return { deal: null, missing: true, failed: false };

  const deal = asDeal((result.body as { deal?: unknown })?.deal);
  if (result.status === 200 && deal) return { deal, missing: false, failed: false };
  return { deal: null, missing: false, failed: true };
}