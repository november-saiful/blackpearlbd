import { createSupabaseAdminClient } from './supabase';
import type { Env } from '../types';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_approved'
  | 'booking_rejected'
  | 'booking_processing'
  | 'package_approved'
  | 'package_rejected'
  | 'package_processing'
  | 'pearls_earned'
  | 'welcome';

interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert an in-app notification for a user.
 *
 * Email sending is intentionally not included here — it will be added in a
 * future phase with Resend. For now this only writes to the notifications
 * table so the frontend bell icon can pick it up.
 */
export async function notify(env: Env, opts: NotifyOptions): Promise<void> {
  try {
    const admin = createSupabaseAdminClient(env);
    const { error } = await admin.from('notifications').insert({
      user_id: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link || null,
      metadata: opts.metadata || {},
    });
    if (error) {
      console.error('Failed to create notification:', error);
    }
  } catch (err) {
    // Notification failure must never block the parent operation
    console.error('Notification error:', err);
  }
}
