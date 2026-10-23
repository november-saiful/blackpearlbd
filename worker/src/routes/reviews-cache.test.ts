import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  /** One entry per Supabase call, so a cache hit is provable by the count. */
  calls: [] as string[],
  reviews: [] as Array<Record<string, unknown>>,
}));

// Chainable stand-in for the Supabase query builder. It records the table of
// every call and filters the review rows by the `eq` values the route applied,
// which is enough for the route to behave without a database.
vi.mock('../lib/supabase', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      state.calls.push(table);
      const filters: Record<string, unknown> = {};
      const chain: any = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        single: () => Promise.resolve(resultFor(table, filters)),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resultFor(table, filters)).then(resolve),
      };
      return chain;
    },
  }),
}));

function resultFor(table: string, filters: Record<string, unknown>) {
  if (table === 'tour_deals') {
    if (filters.slug === 'retired-deal') {
      return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    return { data: { id: 'deal-1' }, error: null };
  }
  const rows = state.reviews.filter((row) =>
    Object.entries(filters).every(([key, value]) => row[key] === value),
  );
  return { data: rows, error: null };
}

vi.mock('../middleware/auth', () => ({
  authMiddleware: (c: any) => c.json({ error: 'auth middleware reached' }, 401),
  optionalAuthMiddleware: async (c: any, next: any) => {
    const userId = c.req.header('X-Test-User');
    if (userId) c.set('userId', userId);
    await next();
  },
}));

import reviews from './reviews';
import type { Env } from '../types';

const env = {} as Env;

function approved(slugPart: string) {
  return {
    id: `approved-${slugPart}`,
    deal_id: 'deal-1',
    user_id: 'other-user',
    rating: 5,
    is_approved: true,
  };
}

function pending(slugPart: string) {
  return {
    id: `pending-${slugPart}`,
    deal_id: 'deal-1',
    user_id: 'author-1',
    rating: 4,
    is_approved: false,
  };
}

describe('public review caching', () => {
  beforeEach(() => {
    state.calls = [];
    state.reviews = [];
  });

  it('serves a repeat visit without touching the database', async () => {
    state.reviews = [approved('a')];

    const first = await reviews.request('/deals/deal-a', { env });
    const firstBody = await first.json();
    expect(first.headers.get('X-Geo-Cache')).toBe('origin');
    expect(firstBody.reviews).toHaveLength(1);
    expect(firstBody.stats.review_count).toBe(1);
    const callsAfterOrigin = state.calls.length;

    const second = await reviews.request('/deals/deal-a', { env });
    expect(second.headers.get('X-Geo-Cache')).toBe('isolate');
    expect(await second.json()).toEqual(firstBody);
    expect(state.calls).toHaveLength(callsAfterOrigin);
  });

  it('answers a signed-in visitor from the shared entry plus their own pending review', async () => {
    state.reviews = [approved('b'), pending('b')];

    const anonymous = await reviews.request('/deals/deal-b', { env });
    expect((await anonymous.json()).reviews).toHaveLength(1);

    const asAuthor = await reviews.request('/deals/deal-b', {
      headers: { 'X-Test-User': 'author-1' },
      env,
    });
    const body = await asAuthor.json();
    expect(body.reviews.map((row: { id: string }) => row.id)).toEqual([
      'approved-b',
      'pending-b',
    ]);
    // Stats stay about the deal, not about whoever is asking.
    expect(body.stats.review_count).toBe(1);

    // The merged response must not become the shared entry.
    const next = await reviews.request('/deals/deal-b', { env });
    expect((await next.json()).reviews).toHaveLength(1);
  });

  it('keeps the per-author read to one query on a warm deal', async () => {
    state.reviews = [approved('c'), pending('c')];

    await reviews.request('/deals/deal-c', { env });
    state.calls = [];

    await reviews.request('/deals/deal-c', {
      headers: { 'X-Test-User': 'author-1' },
      env,
    });
    expect(state.calls).toEqual(['reviews']);
  });

  it('caches the homepage testimonial slice', async () => {
    state.reviews = [approved('d')];

    const first = await reviews.request('/featured?limit=6', { env });
    expect(first.headers.get('X-Geo-Cache')).toBe('origin');
    expect((await first.json()).reviews).toHaveLength(1);

    const second = await reviews.request('/featured?limit=6', { env });
    expect(second.headers.get('X-Geo-Cache')).toBe('isolate');
  });

  it('states the cache directive once, with the TTL the entry is stored for', async () => {
    state.reviews = [approved('e')];

    const response = await reviews.request('/deals/deal-e', { env });
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, must-revalidate');
  });

  it('still reports an unknown deal as missing, and remembers that too', async () => {
    const first = await reviews.request('/deals/retired-deal', { env });
    expect(first.status).toBe(404);

    state.calls = [];
    const second = await reviews.request('/deals/retired-deal', { env });
    expect(second.status).toBe(404);
    expect(second.headers.get('X-Geo-Cache')).toBe('isolate');
    expect(state.calls).toEqual([]);
  });
});
