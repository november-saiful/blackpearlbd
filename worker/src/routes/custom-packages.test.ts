import { describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock('../lib/supabase', () => ({
  createSupabaseAdminClient: () => ({
    from() {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: shared.rows, error: null }));
        },
      };
      return query;
    },
  }),
}));

// If the static route is accidentally placed after `/:id`, this middleware
// would answer the request with 401 instead of allowing the public route.
vi.mock('../middleware/auth', () => ({
  authMiddleware: (c: any) => c.json({ error: 'auth middleware reached' }, 401),
}));

import customPackages from './custom-packages';
import type { Env } from '../types';

describe('GET /custom-packages/package-destinations', () => {
  it('returns the current admin-managed display name without auth', async () => {
    shared.rows = [
      {
        id: 'destination-1',
        category: 'Bangladesh',
        name: 'Bangladesh (Division-tour)',
        value: 'bangladesh-customized',
        sort_order: 0,
        is_active: true,
      },
    ];

    const response = await customPackages.request(
      '/package-destinations',
      {},
      {} as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ destinations: shared.rows });
  });
});
