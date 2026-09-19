import { Hono } from 'hono';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { CreateReviewSchema, UpdateReviewSchema, UpdateReviewStatusSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { Env } from '../types';

const reviews = new Hono();

// ── Public: latest approved reviews across all deals (for homepage testimonials) ─
reviews.get('/featured', async (c) => {
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  const { data, error } = await admin
    .from('reviews')
    .select('*, user:profiles(full_name, avatar_url), deal:tour_deals(title, slug)')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return c.json({ error: 'Failed to fetch reviews' }, 500);
  }

  return c.json({ reviews: data || [] });
});

// ── Public: list reviews for a deal ────────────────────────────────────────
// Returns all approved reviews plus the current user's own unapproved reviews
// so the author can see their pending review immediately.
reviews.get('/deals/:slug', optionalAuthMiddleware, async (c) => {
  const slug = c.req.param('slug');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);
  const userId = c.get('userId');

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

  // Fetch all approved reviews for this deal
  const { data: approvedData, error: approvedError } = await admin
    .from('reviews')
    .select('*, user:profiles(full_name, avatar_url)')
    .eq('deal_id', deal.id)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  if (approvedError) {
    return c.json({ error: 'Failed to fetch reviews' }, 500);
  }

  const allApproved = approvedData || [];

  // If the user is authenticated, also fetch their own unapproved review(s)
  let userPending: typeof allApproved = [];
  if (userId) {
    const { data: pendingData } = await admin
      .from('reviews')
      .select('*, user:profiles(full_name, avatar_url)')
      .eq('deal_id', deal.id)
      .eq('user_id', userId)
      .eq('is_approved', false)
      .order('created_at', { ascending: false });

    if (pendingData) {
      userPending = pendingData;
    }
  }

  // Merge: approved first (newest first), then user's pending reviews at the end.
  // Deduplicate by id in case the user's review was just approved between queries.
  const approvedIds = new Set(allApproved.map((r) => r.id));
  const uniquePending = userPending.filter((r) => !approvedIds.has(r.id));
  const mergedReviews = [...allApproved, ...uniquePending];

  // Stats are computed from approved reviews only
  const total = allApproved.length;
  const avgRating = total > 0
    ? Math.round((allApproved.reduce((sum, r) => sum + r.rating, 0) / total) * 100) / 100
    : 0;
  const distribution = [0, 0, 0, 0, 0];
  for (const r of allApproved) {
    distribution[r.rating - 1]++;
  }

  return c.json({
    reviews: mergedReviews,
    stats: { avg_rating: avgRating, review_count: total, distribution },
  });
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
