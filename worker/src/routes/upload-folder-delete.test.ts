import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The route handlers are exercised through the real Hono app, so the request
 * shape, the status codes and the middleware chain are all the shipped ones.
 * Only the two things a Worker test cannot have — Supabase and R2 — are faked.
 *
 * `vi.hoisted` runs before the imports below, so the mocked supabase factory
 * has something to read when `./upload` is first imported.
 */
const shared = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../lib/supabase', () => ({
  createSupabaseAdminClient: () => shared.client,
}));

// Auth is not what this file is about; the middleware only has to let the
// request through with a user id, which is what the handler reads.
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('userId', 'user-1');
    await next();
  },
}));

vi.mock('../middleware/admin', () => ({
  adminMiddleware: async (_c: any, next: any) => {
    await next();
  },
}));

import upload, { dealImageUrls, pointsIntoFolder, stripFolderFromDeal } from './upload';
import type { Env } from '../types';

const REL = 'https://api.example.com/upload/image';
const PREFIX = 'deals/kuakata-sea/';

// ── Fakes ────────────────────────────────────────────────────────

type Row = Record<string, any>;

/**
 * Minimal stand-in for the Supabase queries these two endpoints make: one
 * `select()` that resolves to the rows, and one `update().eq()`.
 */
function createFakeSupabase(rows: Row[], events: string[]) {
  return {
    from() {
      return {
        select() {
          return Promise.resolve({ data: rows, error: null });
        },
        update(values: Row) {
          return {
            eq(column: string, value: string) {
              const row = rows.find((candidate) => candidate[column] === value);
              if (row) Object.assign(row, values);
              events.push(`db:update:${value}`);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

/** An in-memory R2 bucket, keyed the way real keys are. */
function createFakeBucket(keys: string[], events: string[], failDelete = false) {
  const store = new Map(keys.map((key) => [key, new Uint8Array([1])]));

  return {
    store,
    async list(options: { prefix?: string; limit?: number } = {}) {
      const prefix = options.prefix ?? '';
      const limit = options.limit ?? 1000;
      return {
        objects: [...store.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort()
          .slice(0, limit)
          .map((key) => ({ key, size: 1, httpMetadata: { contentType: 'image/jpeg' } })),
        truncated: false,
        delimitedPrefixes: [],
      };
    },
    async delete(keys: string | string[]) {
      if (failDelete) throw new Error('R2 unavailable');
      const list = Array.isArray(keys) ? keys : [keys];
      events.push(`r2:delete:${list.length}`);
      for (const key of list) store.delete(key);
    },
  };
}

/** A deal row that stores one photo in the folder and one outside it. */
function dealRow(overrides: Row = {}): Row {
  return {
    id: 'deal-1',
    title: 'Kuakata Sea & Heritage Tour',
    slug: 'kuakata-sea',
    image_url: `${REL}/deals/kuakata-sea/a.jpg`,
    gallery: [`${REL}/deals/kuakata-sea/a.jpg`, `${REL}/deals/other/b.jpg`],
    hidden_gallery: [],
    itinerary: [],
    route_waypoints: [],
    ...overrides,
  };
}

/** A parsed JSON body, typed for assertion rather than left as `unknown`. */
async function body(response: Response): Promise<Row> {
  return (await response.json()) as Row;
}

function post(prefix: string, unlinkReferences?: boolean) {
  const body: Row = { prefix };
  if (unlinkReferences !== undefined) body.unlinkReferences = unlinkReferences;
  return {
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Shared helper logic ──────────────────────────────────────────

describe('pointsIntoFolder', () => {
  it('recognises a key inside the folder, absolute or relative', () => {
    expect(pointsIntoFolder(`${REL}/deals/kuakata-sea/a.jpg`, PREFIX)).toBe(true);
    expect(pointsIntoFolder('/upload/image/deals/kuakata-sea/a.jpg', PREFIX)).toBe(true);
  });

  it('rejects a sibling folder, an external host, and non-strings', () => {
    expect(pointsIntoFolder(`${REL}/deals/other/b.jpg`, PREFIX)).toBe(false);
    expect(pointsIntoFolder('https://cdn.example.com/pic.jpg', PREFIX)).toBe(false);
    expect(pointsIntoFolder(null, PREFIX)).toBe(false);
    expect(pointsIntoFolder(undefined, PREFIX)).toBe(false);
    expect(pointsIntoFolder(42, PREFIX)).toBe(false);
  });
});

describe('dealImageUrls', () => {
  it('collects every place a deal keeps photos, without duplicates', () => {
    const urls = dealImageUrls(
      dealRow({
        hidden_gallery: [`${REL}/deals/kuakata-sea/c.jpg`],
        itinerary: [{ title: 'D1', photos: [`${REL}/deals/kuakata-sea/d.jpg`] }],
        route_waypoints: [{ image: `${REL}/deals/kuakata-sea/e.jpg` }, { image: null }],
      }),
    );

    // a.jpg appears as both the main image and a gallery entry.
    expect(urls).toEqual([
      `${REL}/deals/kuakata-sea/a.jpg`,
      `${REL}/deals/other/b.jpg`,
      `${REL}/deals/kuakata-sea/c.jpg`,
      `${REL}/deals/kuakata-sea/d.jpg`,
      `${REL}/deals/kuakata-sea/e.jpg`,
    ]);
  });

  it('tolerates the nulls and odd shapes older rows carry', () => {
    expect(dealImageUrls({})).toEqual([]);
    expect(dealImageUrls({ image_url: null, gallery: null, itinerary: null })).toEqual([]);
    expect(dealImageUrls({ gallery: ['', null, undefined] })).toEqual([]);
  });
});

describe('stripFolderFromDeal', () => {
  it('clears the folder from every field and points the main image at a survivor', () => {
    const updates = stripFolderFromDeal(
      dealRow({
        hidden_gallery: [`${REL}/deals/kuakata-sea/c.jpg`, `${REL}/deals/other/keep.jpg`],
        itinerary: [
          { title: 'D1', photos: [`${REL}/deals/kuakata-sea/d.jpg`, `${REL}/deals/other/e.jpg`] },
          { title: 'D2', photos: [`${REL}/deals/other/f.jpg`] },
        ],
        route_waypoints: [
          { lat: 1, lng: 2, image: `${REL}/deals/kuakata-sea/g.jpg` },
          { lat: 3, lng: 4, image: `${REL}/deals/other/h.jpg` },
        ],
      }),
      PREFIX,
    ) as Row;

    expect(updates.gallery).toEqual([`${REL}/deals/other/b.jpg`]);
    expect(updates.hidden_gallery).toEqual([`${REL}/deals/other/keep.jpg`]);
    expect(updates.image_url).toBe(`${REL}/deals/other/b.jpg`);
    expect(updates.itinerary[0]).toEqual({ title: 'D1', photos: [`${REL}/deals/other/e.jpg`] });
    expect(updates.itinerary[1]).toEqual({ title: 'D2', photos: [`${REL}/deals/other/f.jpg`] });
    expect(updates.route_waypoints[0]).toEqual({ lat: 1, lng: 2, image: null });
    expect(updates.route_waypoints[1]).toEqual({ lat: 3, lng: 4, image: `${REL}/deals/other/h.jpg` });
  });

  it('blanks the main image when nothing survives, rather than leaving a dead link', () => {
    const updates = stripFolderFromDeal(
      { image_url: `${REL}/deals/kuakata-sea/a.jpg`, gallery: [`${REL}/deals/kuakata-sea/a.jpg`] },
      PREFIX,
    ) as Row;

    expect(updates.image_url).toBe('');
    expect(updates.gallery).toEqual([]);
  });

  it('leaves an unaffected main image out of the update entirely', () => {
    const updates = stripFolderFromDeal(
      { image_url: `${REL}/deals/other/b.jpg`, gallery: [`${REL}/deals/other/b.jpg`] },
      PREFIX,
    ) as Row;

    // Absent, not merely unchanged: no write is issued for something the
    // folder never touched.
    expect('image_url' in updates).toBe(false);
  });

  it('produces nothing to write for a row with no image fields at all', () => {
    expect(stripFolderFromDeal({}, PREFIX)).toEqual({});
  });
});

// ── Endpoints ────────────────────────────────────────────────────

describe('GET /upload/folder-usage', () => {
  beforeEach(() => {
    shared.client = createFakeSupabase([dealRow()], []);
  });

  it('rejects a missing prefix', async () => {
    const response = await upload.request('/folder-usage', {}, { BLACKPEARL_BUCKET: createFakeBucket([], []) } as unknown as Env);
    expect(response.status).toBe(400);
  });

  it('reports the file count and the deals pointing into the folder', async () => {
    const bucket = createFakeBucket(
      ['deals/kuakata-sea/a.jpg', 'deals/kuakata-sea/b.jpg', 'deals/other/c.jpg'],
      [],
    );

    const response = await upload.request(
      '/folder-usage?prefix=deals/kuakata-sea',
      {},
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.fileCount).toBe(2);
    expect(payload.totalImages).toBe(1);
    expect(payload.deals).toEqual([
      { id: 'deal-1', title: 'Kuakata Sea & Heritage Tour', slug: 'kuakata-sea', imageCount: 1 },
    ]);
  });
});

describe('POST /upload/delete-folder', () => {
  const keys = ['deals/kuakata-sea/a.jpg', 'deals/kuakata-sea/b.jpg'];

  it('refuses with 409 while a deal still points into the folder', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events);
    shared.client = createFakeSupabase([dealRow()], events);

    const response = await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea'),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(409);
    const payload = await body(response);
    expect(payload.error).toMatch(/still used/i);
    expect(payload.totalImages).toBe(1);
    expect(payload.deals[0].title).toBe('Kuakata Sea & Heritage Tour');

    // The refusal has to be inert: nothing removed, nothing rewritten.
    expect(bucket.store.size).toBe(2);
    expect(events).toEqual([]);
  });

  it('also refuses when unlinkReferences is explicitly false', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events);
    shared.client = createFakeSupabase([dealRow()], events);

    const response = await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea', false),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(409);
    expect(bucket.store.size).toBe(2);
  });

  it('deletes and clears the references when asked to unlink', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events);
    const row = dealRow({ hidden_gallery: [`${REL}/deals/kuakata-sea/c.jpg`] });
    shared.client = createFakeSupabase([row], events);

    const response = await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea', true),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      prefix: PREFIX,
      deleted: 2,
      unlinkedDeals: 1,
    });

    expect(bucket.store.size).toBe(0);
    expect(row.gallery).toEqual([`${REL}/deals/other/b.jpg`]);
    expect(row.image_url).toBe(`${REL}/deals/other/b.jpg`);
    expect(row.hidden_gallery).toEqual([]);
  });

  it('clears the references before removing the objects', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events);
    shared.client = createFakeSupabase([dealRow()], events);

    await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea', true),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    // The other order would leave deals pointing at photos that are already
    // gone if the write failed partway.
    const updateIndex = events.findIndex((event) => event.startsWith('db:update'));
    const deleteIndex = events.findIndex((event) => event.startsWith('r2:delete'));
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(updateIndex);
  });

  it('deletes an unreferenced folder without touching any deal', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events);
    shared.client = createFakeSupabase([dealRow()], events);

    const response = await upload.request(
      '/delete-folder',
      post('deals/nobody-uses-this'),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: 0, unlinkedDeals: 0 });
    // The other deal's photos are untouched.
    expect(bucket.store.size).toBe(2);
    expect(events).toEqual([]);
  });

  it('rejects a missing prefix, the bucket root, and a whole namespace', async () => {
    shared.client = createFakeSupabase([], []);
    const bucket = createFakeBucket(['deals/other/b.jpg'], []);
    const env = { BLACKPEARL_BUCKET: bucket } as unknown as Env;

    // "deals" is one segment: deleting it would take every deal image at once,
    // so it is refused even though it looks like an ordinary folder tile.
    for (const prefix of ['', 'deals', '/', 'deals/']) {
      const response = await upload.request('/delete-folder', post(prefix, true), env);
      expect(response.status, `prefix "${prefix}" should be refused`).toBe(400);
    }

    expect(bucket.store.size).toBe(1);
  });

  it('reports a storage failure rather than pretending the folder went', async () => {
    const events: string[] = [];
    const bucket = createFakeBucket(keys, events, true);
    shared.client = createFakeSupabase([dealRow()], events);

    // Hono logs the unhandled error; this test is causing it on purpose, so the
    // noise is silenced rather than left in the run's output.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea', true),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );
    logged.mockRestore();

    // Unhandled in the route, so Hono's default handler answers; the point is
    // that it is not a 2xx claiming success.
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(bucket.store.size).toBe(2);
  });

  it('reports 500 when the usage check itself cannot be answered', async () => {
    shared.client = {
      from() {
        return {
          select() {
            return Promise.resolve({ data: null, error: { message: 'boom' } });
          },
        };
      },
    };
    const bucket = createFakeBucket(keys, []);

    const response = await upload.request(
      '/delete-folder',
      post('deals/kuakata-sea', true),
      { BLACKPEARL_BUCKET: bucket } as unknown as Env,
    );

    expect(response.status).toBe(500);
    expect(bucket.store.size).toBe(2);
  });
});
