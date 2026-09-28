import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ inserted: null as Record<string, unknown> | null }));

// Chainable stand-in for the Supabase query builder: the route reads the
// package_code prefix, then inserts. `then` makes the read chain awaitable.
vi.mock('../lib/supabase', () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        like: () => chain,
        order: () => chain,
        eq: () => chain,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: [], error: null })),
        insert: (row: Record<string, unknown>) => {
          captured.inserted = row;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...row, id: 'pkg-1' }, error: null }),
            }),
          };
        },
      };
      return chain;
    },
  }),
}));

// The guest path is the point of these tests, so auth is a header-driven stub:
// no header means anonymous, X-Test-User acts as a signed-in session.
vi.mock('../middleware/auth', () => ({
  authMiddleware: (c: any) => c.json({ error: 'auth middleware reached' }, 401),
  optionalAuthMiddleware: async (c: any, next: any) => {
    const userId = c.req.header('X-Test-User');
    if (userId) c.set('userId', userId);
    await next();
  },
}));

import customPackages from './custom-packages';
import type { Env } from '../types';

const builderPayload = {
  title: 'Thailand',
  destination_value: 'thailand',
  budget: 85000,
  travel_date: '2026-11-02',
  return_date: '2026-11-08',
  num_travelers: 2,
  accommodation_type: 'standard',
  transport_type: 'flight',
  activities: ['Sightseeing'],
};

/** The row the route handed to Supabase, asserted to exist. */
function insertedRow(): Record<string, unknown> {
  if (!captured.inserted) throw new Error('expected a row to be inserted');
  return captured.inserted;
}

function post(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return customPackages.request(
    '/',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
    },
    {} as Env,
  );
}

describe('POST /custom-packages', () => {
  it('accepts a guest request that carries name, phone and location', async () => {
    captured.inserted = null;

    const response = await post({
      ...builderPayload,
      contact_name: 'Rahat Hossain',
      contact_phone: '01711223344',
      contact_location: 'Sylhet',
    });

    expect(response.status).toBe(201);
    const row = insertedRow();
    expect(row.user_id).toBeNull();
    expect(row.contact_name).toBe('Rahat Hossain');
    expect(row.contact_location).toBe('Sylhet');
  });

  it('rejects a guest request with no way to answer it', async () => {
    captured.inserted = null;

    const response = await post(builderPayload);

    expect(response.status).toBe(400);
    expect(captured.inserted).toBeNull();
  });

  it('rejects a guest request that only half identifies the traveller', async () => {
    const response = await post({
      ...builderPayload,
      contact_name: 'Rahat Hossain',
      contact_phone: '01711223344',
    });

    expect(response.status).toBe(400);
  });

  it('does not require contact details when a user is signed in', async () => {
    captured.inserted = null;

    const response = await post(builderPayload, { 'X-Test-User': 'user-1' });

    expect(response.status).toBe(201);
    expect(insertedRow().user_id).toBe('user-1');
  });

  it('still rejects a request with no destination at all', async () => {
    const { destination_value: _slug, ...rest } = builderPayload;

    const response = await post({
      ...rest,
      contact_name: 'Rahat Hossain',
      contact_phone: '01711223344',
      contact_location: 'Sylhet',
    });

    expect(response.status).toBe(400);
  });
});
