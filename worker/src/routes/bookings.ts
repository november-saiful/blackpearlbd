import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { CreateBookingSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { notify } from '../lib/notify';
import type { Env } from '../types';

const bookings = new Hono();

// Create booking (for deals)
bookings.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();
  const result = CreateBookingSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  if (result.data.booking_type === 'deal' && !result.data.deal_id) {
    return c.json({ error: 'deal_id is required for deal bookings' }, 400);
  }

  if (result.data.booking_type === 'custom' && !result.data.custom_package_id) {
    return c.json({ error: 'custom_package_id is required for custom bookings' }, 400);
  }

  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Generate invoice number
  let invoiceNumber = '';

  if (result.data.booking_type === 'deal' && result.data.deal_id) {
    // Deal bookings: {deal_code}-D{serial}
    const { data: deal } = await admin
      .from('tour_deals')
      .select('deal_code')
      .eq('id', result.data.deal_id)
      .single();

    const dealCode = deal?.deal_code;
    if (dealCode) {
      // Find highest serial for this deal_code
      const { data: existing } = await admin
        .from('bookings')
        .select('invoice_number')
        .like('invoice_number', `${dealCode}-D%`)
        .order('invoice_number', { ascending: false });

      let serial = 1;
      if (existing && existing.length > 0) {
        const last = existing[0].invoice_number;
        if (last) {
          const match = last.match(/-D(\d+)$/);
          if (match) serial = parseInt(match[1], 10) + 1;
        }
      }
      invoiceNumber = `${dealCode}-D${serial}`;
    } else {
      invoiceNumber = `BKP-${Date.now()}`;
    }
  } else if (result.data.booking_type === 'custom' && result.data.custom_package_id) {
    // Custom bookings: use the package_code directly
    const { data: pkg } = await admin
      .from('custom_packages')
      .select('package_code')
      .eq('id', result.data.custom_package_id)
      .single();
    invoiceNumber = pkg?.package_code || `BKP-${Date.now()}`;
  } else {
    invoiceNumber = `BKP-${Date.now()}`;
  }

  const { data, error } = await admin
    .from('bookings')
    .insert({
      user_id: userId,
      booking_type: result.data.booking_type,
      deal_id: result.data.deal_id || null,
      custom_package_id: result.data.custom_package_id || null,
      total_amount: result.data.total_amount,
      traveler_details: result.data.traveler_details,
      invoice_number: invoiceNumber,
    })
    .select('*, deal:tour_deals(*), custom_package:custom_packages(*)')
    .single();

  if (error) {
    return c.json({ error: 'Failed to create booking' }, 500);
  }

  // In-app notification for the user
  const dealTitle = data.deal?.title || data.custom_package?.title || 'your trip';
  notify(env, {
    userId,
    type: 'booking_confirmed',
    title: 'Booking submitted',
    body: `Your booking for "${dealTitle}" has been received. We'll review it shortly.`,
    link: '/profile?tab=tours',
    metadata: { booking_id: data.id, amount: data.total_amount },
  });

  // Notify admins about new booking
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    for (const adminUser of admins) {
      notify(env, {
        userId: adminUser.id,
        type: 'booking_confirmed',
        title: 'New booking received',
        body: `A new booking for "${dealTitle}" needs review.`,
        link: '/admin/bookings',
        metadata: { booking_id: data.id, amount: data.total_amount },
      });
    }
  }

  return c.json({ booking: data }, 201);
});

// List user's bookings
bookings.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data, error } = await admin
    .from('bookings')
    .select(`
      *,
      deal:tour_deals(*),
      custom_package:custom_packages(*)
    `)
    .eq('user_id', userId)
    .order('booked_at', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch bookings' }, 500);
  }

  return c.json({ bookings: data || [] });
});

// Generate invoice data
bookings.get('/:id/invoice', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data: booking, error } = await admin
    .from('bookings')
    .select(`
      *,
      deal:tour_deals(*),
      custom_package:custom_packages(*),
      user:profiles(full_name, email, phone)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  return c.json({ invoice: booking });
});

export default bookings;
