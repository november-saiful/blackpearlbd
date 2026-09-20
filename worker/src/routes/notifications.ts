import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseAdminClient } from '../lib/supabase';
import type { Env } from '../types';

const notifications = new Hono();

// List user's notifications (newest first, paginated)
notifications.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const { data, count, error } = await admin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }

  return c.json({
    notifications: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
});

// Unread count
notifications.get('/unread-count', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { count, error } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    return c.json({ count: 0 });
  }

  return c.json({ count: count || 0 });
});

// Mark one notification as read
notifications.patch('/:id/read', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }

  return c.json({ success: true });
});

// Mark all as read
notifications.patch('/read-all', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    return c.json({ error: 'Failed to mark notifications as read' }, 500);
  }

  return c.json({ success: true });
});

export default notifications;
