import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { UpdateBookingStatusSchema, UpdateCustomPackageStatusSchema, UpdateAdminUserSchema, CreatePackageDestinationSchema, UpdatePackageDestinationSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { notify } from '../lib/notify';
import type { Env } from '../types';

const admin = new Hono();

// Dashboard stats
admin.get('/stats', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  // Total users
  const { count: totalUsers } = await adminClient
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Total bookings
  const { count: totalBookings } = await adminClient
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  // Total revenue (approved bookings)
  const { data: revenueData } = await adminClient
    .from('bookings')
    .select('total_amount')
    .eq('status', 'approved');

  const totalRevenue = revenueData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  // Pending approvals
  const { count: pendingApprovals } = await adminClient
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Recent bookings (last 10)
  const { data: recentBookings } = await adminClient
    .from('bookings')
    .select(`
      *,
      user:profiles(full_name, email),
      deal:tour_deals(title, destination),
      custom_package:custom_packages(title, destination_id)
    `)
    .order('booked_at', { ascending: false })
    .limit(10);

  return c.json({
    stats: {
      totalUsers: totalUsers || 0,
      totalBookings: totalBookings || 0,
      totalRevenue,
      pendingApprovals: pendingApprovals || 0,
    },
    recentBookings: recentBookings || [],
  });
});

// List all users with pagination
admin.get('/users', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const search = c.req.query('search') || '';
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }

  return c.json({
    users: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
});

// List all bookings with filters
admin.get('/bookings', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const status = c.req.query('status');
  const type = c.req.query('type');
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('bookings')
    .select(`
      *,
      user:profiles(full_name, email),
      deal:tour_deals(title, destination),
      custom_package:custom_packages(title)
    `, { count: 'exact' })
    .order('booked_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (type) {
    query = query.eq('booking_type', type);
  }

  const { data, count, error } = await query;

  if (error) {
    return c.json({ error: 'Failed to fetch bookings' }, 500);
  }

  return c.json({
    bookings: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
});

// Delete booking
admin.delete('/bookings/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { error } = await adminClient
    .from('bookings')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: 'Failed to delete booking' }, 500);
  }

  return c.json({ success: true });
});

// Update booking status
admin.patch('/bookings/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateBookingStatusSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const updateData: Record<string, unknown> = {
    status: result.data.status,
    updated_at: new Date().toISOString(),
  };
  if (result.data.admin_notes !== undefined) {
    updateData.admin_notes = result.data.admin_notes;
  }

  const { data, error } = await adminClient
    .from('bookings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to update booking' }, 500);
  }

  // Send notification to the booking owner
  const statusMessages: Record<string, { type: 'booking_approved' | 'booking_rejected' | 'booking_processing'; title: string; body: string }> = {
    approved: { type: 'booking_approved', title: 'Booking approved!', body: 'Your booking has been approved. 10 Pearls have been awarded!' },
    rejected: { type: 'booking_rejected', title: 'Booking update', body: 'Your booking was not approved. Please contact us for details.' },
    processing: { type: 'booking_processing', title: 'Booking in progress', body: 'Your booking is being processed.' },
  };

  if (statusMessages[result.data.status] && data.user_id) {
    // Fetch booking details for the notification
    const { data: bookingDetail } = await adminClient
      .from('bookings')
      .select('deal:tour_deals(title), custom_package:custom_packages(title)')
      .eq('id', id)
      .single();

    const dealTitle = (bookingDetail as any)?.deal?.title || (bookingDetail as any)?.custom_package?.title || 'your trip';
    const msg = statusMessages[result.data.status];

    notify(env, {
      userId: data.user_id,
      type: msg.type,
      title: msg.title,
      body: msg.title === 'Booking approved!'
        ? `Your booking for "${dealTitle}" has been approved. 10 Pearls awarded! 🎉`
        : msg.title === 'Booking update'
        ? `Your booking for "${dealTitle}" was not approved. Please contact us for details.`
        : `Your booking for "${dealTitle}" is being processed.`,
      link: '/profile?tab=tours',
      metadata: { booking_id: id, status: result.data.status },
    });
  }

  return c.json({ booking: data });
});

// List all custom packages
admin.get('/custom-packages', authMiddleware, adminMiddleware, async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const { data, count, error } = await adminClient
    .from('custom_packages')
    .select(`
      *,
      user:profiles(full_name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: 'Failed to fetch custom packages' }, 500);
  }

  return c.json({
    customPackages: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
});

// Update custom package status
admin.patch('/custom-packages/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateCustomPackageStatusSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const updateData: Record<string, unknown> = {
    status: result.data.status,
    updated_at: new Date().toISOString(),
  };
  if (result.data.admin_notes !== undefined) {
    updateData.admin_notes = result.data.admin_notes;
  }
  if (result.data.estimated_price !== undefined) {
    updateData.estimated_price = result.data.estimated_price;
  }

  const { data, error } = await adminClient
    .from('custom_packages')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to update custom package' }, 500);
  }

  // Notify the package owner
  const pkgStatusMessages: Record<string, { type: 'package_approved' | 'package_rejected' | 'package_processing'; title: string }> = {
    approved: { type: 'package_approved', title: 'Package approved!' },
    rejected: { type: 'package_rejected', title: 'Package update' },
    processing: { type: 'package_processing', title: 'Package in progress' },
  };

  if (pkgStatusMessages[result.data.status] && data.user_id) {
    const msg = pkgStatusMessages[result.data.status];
    notify(env, {
      userId: data.user_id,
      type: msg.type,
      title: msg.title,
      body: msg.title === 'Package approved!'
        ? 'Your custom package has been approved!'
        : msg.title === 'Package update'
        ? 'Your custom package was not approved. Please contact us for details.'
        : 'Your custom package is being processed.',
      link: '/profile',
      metadata: { package_id: id, status: result.data.status },
    });
  }

  return c.json({ customPackage: data });
});

// Update user (role, status, pearls, name)
admin.patch('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateAdminUserSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (result.data.full_name !== undefined) updateData.full_name = result.data.full_name;
  if (result.data.role !== undefined) updateData.role = result.data.role;
  if (result.data.status !== undefined) updateData.status = result.data.status;
  if (result.data.pearls !== undefined) updateData.pearls = result.data.pearls;

  const { data, error } = await adminClient
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to update user' }, 500);
  }

  return c.json({ user: data });
});

// Delete user
admin.delete('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const requestingUserId = c.get('userId');

  // Prevent admin from deleting themselves
  if (requestingUserId === id) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { error } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: 'Failed to delete user' }, 500);
  }

  return c.json({ success: true });
});

// ── Package Destinations CRUD ─────────────────────────────────────────

// List all package destinations (admin sees all, public sees active only)
admin.get('/package-destinations', async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { data, error } = await adminClient
    .from('package_destinations')
    .select('*')
    .order('category')
    .order('sort_order');

  if (error) {
    return c.json({ error: 'Failed to fetch package destinations' }, 500);
  }

  return c.json({ destinations: data || [] });
});

// Public endpoint: active destinations grouped by category (for package builder)
admin.get('/package-destinations/active', async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { data, error } = await adminClient
    .from('package_destinations')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('sort_order');

  if (error) {
    return c.json({ error: 'Failed to fetch package destinations' }, 500);
  }

  return c.json({ destinations: data || [] });
});

// Create a package destination
admin.post('/package-destinations', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = CreatePackageDestinationSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { data, error } = await adminClient
    .from('package_destinations')
    .insert(result.data)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A destination with this value already exists' }, 409);
    }
    return c.json({ error: 'Failed to create package destination' }, 500);
  }

  return c.json({ destination: data }, 201);
});

// Update a package destination
admin.patch('/package-destinations/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdatePackageDestinationSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { data, error } = await adminClient
    .from('package_destinations')
    .update(result.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A destination with this value already exists' }, 409);
    }
    return c.json({ error: 'Failed to update package destination' }, 500);
  }

  return c.json({ destination: data });
});

// Delete a package destination
admin.delete('/package-destinations/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);

  const { error } = await adminClient
    .from('package_destinations')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: 'Failed to delete package destination' }, 500);
  }

  return c.json({ success: true });
});

// ── Package Districts CRUD ─────────────────────────────────────────

admin.get('/package-districts', async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const division = c.req.query('division');

  let query = adminClient.from('package_districts').select('*').order('sort_order');
  if (division) query = query.eq('division_value', division);

  const { data, error } = await query;
  if (error) return c.json({ error: 'Failed to fetch districts' }, 500);
  return c.json({ districts: data || [] });
});

admin.post('/package-districts', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  if (!body.division_value || !body.name) return c.json({ error: 'division_value and name required' }, 400);
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const { data, error } = await adminClient.from('package_districts').insert({
    division_value: body.division_value,
    name: body.name,
    sort_order: body.sort_order ?? 0,
    is_active: body.is_active ?? true,
  }).select().single();
  if (error) return c.json({ error: 'Failed to create district' }, 500);
  return c.json({ district: data }, 201);
});

admin.patch('/package-districts/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.division_value !== undefined) updateData.division_value = body.division_value;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  const { data, error } = await adminClient.from('package_districts').update(updateData).eq('id', id).select().single();
  if (error) return c.json({ error: 'Failed to update district' }, 500);
  return c.json({ district: data });
});

admin.delete('/package-districts/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const { error } = await adminClient.from('package_districts').delete().eq('id', id);
  if (error) return c.json({ error: 'Failed to delete district' }, 500);
  return c.json({ success: true });
});

// ── Package Tour Spots CRUD ───────────────────────────────────────

admin.get('/package-tour-spots', async (c) => {
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const districtId = c.req.query('district_id');

  let query = adminClient.from('package_tour_spots').select('*, district:package_districts(name, division_value)').order('sort_order');
  if (districtId) query = query.eq('district_id', districtId);

  const { data, error } = await query;
  if (error) return c.json({ error: 'Failed to fetch tour spots' }, 500);
  return c.json({ tourSpots: data || [] });
});

admin.post('/package-tour-spots', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  if (!body.district_id || !body.name) return c.json({ error: 'district_id and name required' }, 400);
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const { data, error } = await adminClient.from('package_tour_spots').insert({
    district_id: body.district_id,
    name: body.name,
    sort_order: body.sort_order ?? 0,
    is_active: body.is_active ?? true,
  }).select('*, district:package_districts(name, division_value)').single();
  if (error) return c.json({ error: 'Failed to create tour spot' }, 500);
  return c.json({ tourSpot: data }, 201);
});

admin.patch('/package-tour-spots/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.district_id !== undefined) updateData.district_id = body.district_id;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  const { data, error } = await adminClient.from('package_tour_spots').update(updateData).eq('id', id).select('*, district:package_districts(name, division_value)').single();
  if (error) return c.json({ error: 'Failed to update tour spot' }, 500);
  return c.json({ tourSpot: data });
});

admin.delete('/package-tour-spots/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const env = c.env as Env;
  const adminClient = createSupabaseAdminClient(env);
  const { error } = await adminClient.from('package_tour_spots').delete().eq('id', id);
  if (error) return c.json({ error: 'Failed to delete tour spot' }, 500);
  return c.json({ success: true });
});

export default admin;
