import { Hono } from 'hono';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { CreateDealSchema, BulkRemoveDealsSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { collectR2ImageKeys } from '../lib/r2';
import { readThroughCache, cacheControlHeader, type CachePolicy } from '../lib/http-cache';
import { Env } from '../types';

const deals = new Hono();

// ── Cache policy: public read-only data, TTLed, Vary'd on the request identity.
const PUBLIC_DEALS_POLICY: CachePolicy = {
  maxAgeSeconds: 60,
  public: true,
  mustRevalidate: true,
  vary: ['Authorization'],
};

const PUBLIC_DEAL_POLICY: CachePolicy = {
  maxAgeSeconds: 30,
  public: true,
  mustRevalidate: true,
};

// List all active deals (public)
deals.get('/', async (c) => {
  const env = c.env as Env;

  // Public, read-only, sort-order-stable data. Cache it at the edge for 60s so
  // repeat visitors (and the next deploy's hero walkthroughs) never hit
  // Supabase again until the entry goes stale.
  const { value, source } = await readThroughCache(
    'deals',
    c.req.raw,
    PUBLIC_DEALS_POLICY,
    async () => {
      const admin = createSupabaseAdminClient(env);
      const { data, error } = await admin
        .from('tour_deals')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { deals: data || [] };
    },
  );

  return c.json(value, 200, {
    'X-Geo-Cache': source,
    'Cache-Control': cacheControlHeader(PUBLIC_DEALS_POLICY),
    'Vary': PUBLIC_DEALS_POLICY.vary?.join(', ')!,
  });
});

// Related deals for a slug: siblings in the same category or within a similar
// price band, closest matches first. Cached at the edge so DealDetail only
// needs one round trip to fetch the deal, its reviews and the sibling list.
deals.get('/related', async (c) => {
  const slug = c.req.query('slug');
  const env = c.env as Env;

  const related = await readThroughCache(
    'related-deals:' + slug,
    c.req.raw,
    PUBLIC_DEAL_POLICY,
    async () => {
      const admin = createSupabaseAdminClient(env);
      const currentResult = await admin
        .from('tour_deals')
        .select('id, category, price')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      if (currentResult.error) return { deals: [] };
      const current = currentResult.data;

      const { data, error: fetchError } = await admin
        .from('tour_deals')
        .select('id, category, price')
        .eq('is_active', true)
        .neq('id', current.id);
      if (fetchError) return { deals: [] };

      const others = (data || []) as Array<{ id: string; category: string; price: number }>;
      const currentCategory = current.category;

      // 1. Same category, closest price first
      const sameCategory = others
        .filter((d) => d.category === currentCategory)
        .sort((a, b) => Math.abs(a.price - current.price) - Math.abs(b.price - current.price));

      // 2. Within a 35% price band, closest first
      const priceLow = current.price * 0.65;
      const priceHigh = current.price * 1.35;
      const nearbyPrice = others
        .filter((d) => d.price >= priceLow && d.price <= priceHigh && d.category !== currentCategory)
        .sort((a, b) => Math.abs(a.price - current.price) - Math.abs(b.price - current.price));

      const combined = [...sameCategory, ...nearbyPrice];
      return { deals: combined.slice(0, 4) };
    },
  );

  return c.json(related.value, 200, {
    'X-Geo-Cache': related.source,
    'Cache-Control': cacheControlHeader(PUBLIC_DEAL_POLICY),
  });
});

// Get single deal details
deals.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const env = c.env as Env;

  // Public deal record. It changes only when an admin publishes or retires a
  // deal, so a 30-second short-TTL means anogin traffic keeps hitting the
  // edge cache while a change lands within a half minute.
  //
  // An unknown slug answers with `deal: null` rather than an error, and is
  // cached like any other read: 404 is the honest answer, and the Pages
  // Function relies on it to keep a dead slug out of the index without
  // mistaking a broken API for a missing deal.
  const { value, source } = await readThroughCache<{ deal: unknown | null }>(
    'deal/' + slug,
    c.req.raw,
    PUBLIC_DEAL_POLICY,
    async () => {
      const admin = createSupabaseAdminClient(env);
      const { data, error } = await admin
        .from('tour_deals')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      if (error) {
        // PGRST116 is "no rows": the slug is not an active deal. Anything else
        // is a real failure and must not be cached as a 404.
        if (error.code === 'PGRST116') return { deal: null };
        throw error;
      }
      return { deal: data };
    },
  );

  return c.json(value, value.deal ? 200 : 404, {
    'X-Geo-Cache': source,
    'Cache-Control': cacheControlHeader(PUBLIC_DEAL_POLICY),
  });
});

// Create new deal (admin only)
deals.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = CreateDealSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const profile = c.get('profile');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Check slug uniqueness before insert
  const { data: existingSlug } = await admin
    .from('tour_deals')
    .select('id')
    .eq('slug', result.data.slug)
    .single();

  if (existingSlug) {
    return c.json({ error: 'A deal with this slug already exists' }, 409);
  }

  // Generate deal_code: #DDMMYY-HHMM
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const deal_code = `#${day}${month}${year}-${hours}${minutes}`;

  const { data, error } = await admin
    .from('tour_deals')
    .insert({ ...result.data, deal_code, created_by: profile.id })
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', JSON.stringify(error));
    if (error.code === '23505') {
      return c.json({ error: 'A deal with this slug already exists' }, 409);
    }
    return c.json({ error: 'Failed to create deal', details: error.message }, 500);
  }

  return c.json({ deal: data }, 201);
});

// Update deal (admin only)
deals.patch('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();  const result = CreateDealSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  // Slug is immutable after creation, strip it from the update payload
  const { slug: _slug, ...updateData } = result.data;

  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);


  const { data, error } = await admin
    .from('tour_deals')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to update deal' }, 500);
  }

  return c.json({ deal: data });
});

// Soft delete deal (admin only)
deals.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { error } = await admin
    .from('tour_deals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return c.json({ error: 'Failed to delete deal' }, 500);
  }

  return c.json({ message: 'Deal deleted successfully' });
});

// Bulk remove deals and their R2 images together (admin only).
//
// Per deal: delete every R2 image object it references (image_url + gallery,
// keys extracted from Worker-served /upload/image/... URLs), then hard-delete
// the row. saved_deals rows cascade automatically; deals that still have
// bookings are skipped because bookings.deal_id has no cascade and deleting
// booking history would be destructive.
//
// R2 deletion happens BEFORE the row delete: an orphaned-image failure leaves a
// deal the admin can retry, whereas deleting the row first would strand its
// images with no admin path back to them.
deals.post('/bulk-remove', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = BulkRemoveDealsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
  }
  const ids = parsed.data.ids;

  const env = c.env as Env;
  if (!env.BLACKPEARL_BUCKET) {
    return c.json({ error: 'Storage not configured' }, 500);
  }
  const adminClient = createSupabaseAdminClient(env);

  const { data: dealsToDelete, error: fetchError } = await adminClient
    .from('tour_deals')
    .select('id, title, image_url, gallery')
    .in('id', ids);

  if (fetchError) {
    return c.json({ error: 'Failed to fetch deals' }, 500);
  }

  const found = new Map((dealsToDelete || []).map((d) => [d.id, d]));
  const results: Array<{ id: string; status: string; images?: number; message?: string }> = [];

  // Which selected ids still have bookings? Those must be skipped.
  const { data: blockingBookings, error: bookingsError } = await adminClient
    .from('bookings')
    .select('deal_id')
    .in('deal_id', ids);
  if (bookingsError) {
    return c.json({ error: 'Failed to check bookings' }, 500);
  }
  const blockedIds = new Set((blockingBookings || []).map((b) => b.deal_id));

  for (const id of ids) {
    const deal = found.get(id);
    if (!deal) {
      results.push({ id, status: 'not_found' });
      continue;
    }
    if (blockedIds.has(id)) {
      results.push({ id, status: 'skipped_has_bookings', message: 'Deal has bookings; remove them first' });
      continue;
    }

    // Delete the R2 images this deal references.
    const keys = collectR2ImageKeys(deal.image_url, deal.gallery);
    let deletedImages = 0;
    let imageFailed = false;
    for (const key of keys) {
      try {
        await env.BLACKPEARL_BUCKET.delete(key);
        deletedImages += 1;
      } catch (err) {
        console.error(`Failed to delete R2 object ${key}:`, err);
        imageFailed = true;
        break;
      }
    }
    if (imageFailed) {
      // Keep the row so the admin can retry instead of stranding images.
      results.push({ id, status: 'error_image', message: 'Image deletion failed; deal kept for retry' });
      continue;
    }

    const { error: deleteError } = await adminClient
      .from('tour_deals')
      .delete()
      .eq('id', id);

    if (deleteError) {
      results.push({ id, status: 'error_row', message: deleteError.message });
      continue;
    }

    results.push({ id, status: 'removed', images: deletedImages });
  }

  const removed = results.filter((r) => r.status === 'removed').length;
  const failed = results.length - removed;

  return c.json({ removed, failed, results }, failed > 0 ? 207 : 200);
});

export default deals;
