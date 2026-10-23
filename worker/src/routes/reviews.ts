import { Hono } from 'hono';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { CreateReviewSchema, UpdateReviewSchema, UpdateReviewStatusSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { readThroughCache, cacheControlHeader, type CachePolicy } from '../lib/http-cache';
import { Env } from '../types';

const reviews = new Hono();

// ── Cache policy ───────────────────────────────────────────────────────────
// Approved reviews are public, read-only, and change only when an admin
// approves or unhides one, so they belong in the same short-TTL cache as the
// deal record they describe. Before this, both public review reads hit Postgres
// on every visit: the slowest call a deal page makes, and the one that never
// got faster no matter how often it was asked.
const PUBLIC_REVIEWS_POLICY: CachePolicy = {
  maxAgeSeconds: 30,
  public: true,
  mustRevalidate: true,
};

type ReviewRow = Record<string, any>;

type ReviewStatsValue = {
  avg_rating: number;
  review_count: number;
  distribution: number[];
};

/**
 * The part of a deal's reviews every visitor shares.
 *
 * `dealId` travels with it because the per-author merge below needs it, and
 * `found` marks a slug that is not an active deal so the route can answer 404
 * without a second lookup.
 */
type CachedDealReviews = {
  dealId: string;
  approved: ReviewRow[];
  stats: ReviewStatsValue;
  found: boolean;
};

const MISSING_DEAL: CachedDealReviews = {
  dealId: '',
  approved: [],
  stats: { avg_rating: 0, review_count: 0, distribution: [0, 0, 0, 0, 0] },
  found: false,
};

// ── Public: latest approved reviews across all deals (for homepage testimonials) ─
reviews.get('/featured', async (c) => {
  const env = c.env as Env;
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  const { value, source } = await readThroughCache<{ reviews: ReviewRow[] }>(
    'featured-reviews',
    c.req.raw,
    PUBLIC_REVIEWS_POLICY,
    async () => {
      const admin = createSupabaseAdminClient(env);
      const { data, error } = await admin
        .from('reviews')
        .select('*, user:profiles(full_name, avatar_url), deal:tour_deals(title, slug)')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { reviews: (data || []) as ReviewRow[] };
    },
  );

  return c.json(value, 200, {
    'X-Geo-Cache': source,
    'Cache-Control': cacheControlHeader(PUBLIC_REVIEWS_POLICY),
  });
});

// ── Public: list reviews for a deal ────────────────────────────────────────
// Returns all approved reviews plus the current user's own unapproved reviews
// so the author can see their pending review immediately.
reviews.get('/deals/:slug', optionalAuthMiddleware, async (c) => {
  const slug = c.req.param('slug');
  const env = c.env as Env;
  const userId = c.get('userId');

  const { value, source } = await readThroughCache<CachedDealReviews>(
    'deal-reviews',
    c.req.raw,
    PUBLIC_REVIEWS_POLICY,
    async () => {
      const admin = createSupabaseAdminClient(env);

      const { data: deal, error: dealError } = await admin
        .from('tour_deals')
        .select('id')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (dealError || !deal) return MISSING_DEAL;

      const { data: approvedData, error: approvedError } = await admin
        .from('reviews')
        .select('*, user:profiles(full_name, avatar_url)')
        .eq('deal_id', deal.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (approvedError) throw approvedError;

      const approved = (approvedData || []) as ReviewRow[];

      // Stats are computed from approved reviews only
      const total = approved.length;
      const avgRating = total > 0
        ? Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / total) * 100) / 100
        : 0;
      const distribution = [0, 0, 0, 0, 0];
      for (const r of approved) {
        distribution[r.rating - 1]++;
      }

      return {
        dealId: deal.id as string,
        approved,
        stats: { avg_rating: avgRating, review_count: total, distribution },
        found: true,
      };
    },
  );

  const cacheHeaders = {
    'X-Geo-Cache': source,
    'Cache-Control': cacheControlHeader(PUBLIC_REVIEWS_POLICY),
  };

  if (!value.found) {
    return c.json({ error: 'Deal not found' }, 404, cacheHeaders);
  }

  // The author's pending review is the one piece of this response that differs
  // between visitors, so it stays outside the shared entry and is merged here.
  let mergedReviews = value.approved;
  if (userId) {
    const admin = createSupabaseAdminClient(env);
    const { data: pendingData } = await admin
      .from('reviews')
      .select('*, user:profiles(full_name, avatar_url)')
      .eq('deal_id', value.dealId)
      .eq('user_id', userId)
      .eq('is_approved', false)
      .order('created_at', { ascending: false });

    if (pendingData) {
      // Deduplicate by id in case the user's review was just approved between queries.
      const approvedIds = new Set(value.approved.map((r) => r.id));
      const uniquePending = (pendingData as ReviewRow[]).filter((r) => !approvedIds.has(r.id));
      mergedReviews = [...value.approved, ...uniquePending];
    }
  }

  return c.json({ reviews: mergedReviews, stats: value.stats }, 200, cacheHeaders);
});

// ── Authenticated: create a review ─────────────────────────────────────────
reviews.post('/deals/:slug', authMiddleware, async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json();
  const result = CreateReviewSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Resolve deal slug → id
  const { data: deal, error: dealError } = await admin
    .from('tour_deals')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (dealError || !deal) {
    return c.json({ error: 'Deal not found' }, 404);
  }

  // Check if user already reviewed this deal
  const { data: existing } = await admin
    .from('reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('deal_id', deal.id)
    .single();

  if (existing) {
    return c.json({ error: 'You have already reviewed this deal' }, 409);
  }

  // Check if user has a booking for this deal (for verified badge)
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('deal_id', deal.id)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  const { data: review, error } = await admin
    .from('reviews')
    .insert({
      user_id: userId,
      deal_id: deal.id,
      booking_id: booking?.id || null,
      rating: result.data.rating,
      title: result.data.title,
      body: result.data.body,
    })
    .select('*, user:profiles(full_name, avatar_url)')
    .single();

  if (error) {
    return c.json({ error: 'Failed to create review' }, 500);
  }

  return c.json({ review }, 201);
});

// ── Authenticated: update own review ───────────────────────────────────────
reviews.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateReviewSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Verify ownership
  const { data: existing } = await admin
    .from('reviews')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return c.json({ error: 'Review not found' }, 404);
  }
  if (existing.user_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const { data: review, error } = await admin
    .from('reviews')
    .update(result.data)
    .eq('id', id)
    .select('*, user:profiles(full_name, avatar_url)')
    .single();

  if (error) {
    return c.json({ error: 'Failed to update review' }, 500);
  }

  return c.json({ review });
});

// ── Authenticated: delete own review ───────────────────────────────────────
reviews.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Verify ownership
  const { data: existing } = await admin
    .from('reviews')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return c.json({ error: 'Review not found' }, 404);
  }
  if (existing.user_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const { error } = await admin
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: 'Failed to delete review' }, 500);
  }

  return c.json({ success: true });
});

// ── Admin: list all reviews for moderation ─────────────────────────────────
reviews.get('/admin', authMiddleware, adminMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { count } = await admin
    .from('reviews')
    .select('*', { count: 'exact', head: true });

  const { data, error } = await admin
    .from('reviews')
    .select('*, user:profiles(full_name, email), deal:tour_deals(title, slug)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: 'Failed to fetch reviews' }, 500);
  }

  return c.json({
    reviews: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
});

// ── Admin: approve/reject a review ─────────────────────────────────────────
reviews.patch('/admin/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateReviewStatusSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data: review, error } = await admin
    .from('reviews')
    .update({ is_approved: result.data.is_approved })
    .eq('id', id)
    .select('*, user:profiles(full_name, email), deal:tour_deals(title, slug)')
    .single();

  if (error) {
    return c.json({ error: 'Failed to update review' }, 500);
  }

  return c.json({ review });
});

export default reviews;
