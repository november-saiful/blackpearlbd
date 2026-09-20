import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { CreateCustomPackageSchema } from '../lib/validators';
import { createSupabaseAdminClient } from '../lib/supabase';
import { Env } from '../types';

const customPackages = new Hono();

// Get cascading destination tree
customPackages.get('/destinations', async (c) => {
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data, error } = await admin
    .from('destinations')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return c.json({ error: 'Failed to fetch destinations' }, 500);
  }

  // Build tree structure
  const destinations = data || [];
  const map = new Map<string, any>();
  const roots: any[] = [];

  destinations.forEach((dest) => {
    map.set(dest.id, { ...dest, children: [] });
  });

  destinations.forEach((dest) => {
    if (dest.parent_id && map.has(dest.parent_id)) {
      map.get(dest.parent_id).children.push(map.get(dest.id));
    } else if (!dest.parent_id) {
      roots.push(map.get(dest.id));
    }
  });

  return c.json({ destinations: roots });
});

// Create custom package
customPackages.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();
  const result = CreateCustomPackageSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.issues }, 400);
  }

  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Generate title if not provided
  const title = result.data.title || `Custom Package - ${new Date().toLocaleDateString()}`;

  // Generate package_code: #DDMMYY-HHMM-C{serial}
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timestampPrefix = `#${day}${month}${year}-${hours}${minutes}`;

  // Find existing packages with the same timestamp prefix to determine serial
  const { data: existingPackages } = await admin
    .from('custom_packages')
    .select('package_code')
    .like('package_code', `${timestampPrefix}-C%`)
    .order('package_code', { ascending: false });

  let serial = 1;
  if (existingPackages && existingPackages.length > 0) {
    // Extract the highest serial number from existing codes
    const lastCode = existingPackages[0].package_code;
    if (lastCode) {
      const match = lastCode.match(/-C(\d+)$/);
      if (match) {
        serial = parseInt(match[1], 10) + 1;
      }
    }
  }
  const package_code = `${timestampPrefix}-C${serial}`;

  const { data, error } = await admin
    .from('custom_packages')
    .insert({
      ...result.data,
      user_id: userId,
      title,
      package_code,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to create custom package' }, 500);
  }

  return c.json({ customPackage: data }, 201);
});

// List user's custom packages
customPackages.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data, error } = await admin
    .from('custom_packages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch custom packages' }, 500);
  }

  return c.json({ customPackages: data || [] });
});

// Get active package destinations (for package builder combobox)
// This static route must be declared before `/:id`, otherwise the parameter
// route captures "package-destinations" and the builder falls back to stale
// hardcoded destination labels.
customPackages.get('/package-destinations', async (c) => {
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data, error } = await admin
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

// Get single custom package
customPackages.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  const { data, error } = await admin
    .from('custom_packages')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return c.json({ error: 'Custom package not found' }, 404);
  }

  return c.json({ customPackage: data });
});

// Book custom package (creates booking)
customPackages.post('/:id/book', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  const env = c.env as Env;
  const admin = createSupabaseAdminClient(env);

  // Get custom package
  const { data: pkg, error: pkgError } = await admin
    .from('custom_packages')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (pkgError || !pkg) {
    return c.json({ error: 'Custom package not found' }, 404);
  }

  if (pkg.status === 'rejected') {
    return c.json({ error: 'Cannot book a rejected package' }, 400);
  }

  // Invoice number = the package_code directly
  const invoiceNumber = pkg.package_code || `BKP-${Date.now()}`;

  // Create booking
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      user_id: userId,
      booking_type: 'custom',
      custom_package_id: id,
      total_amount: pkg.estimated_price || pkg.budget,
      traveler_details: body.traveler_details || {},
      invoice_number: invoiceNumber,
      status: 'pending',
    })
    .select()
    .single();

  if (bookingError) {
    return c.json({ error: 'Failed to create booking' }, 500);
  }

  return c.json({ booking }, 201);
});

export default customPackages;
