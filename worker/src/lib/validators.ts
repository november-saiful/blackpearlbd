import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[+]?[0-9\s-]{10,20}$/).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
});

// Helper: treat empty strings, 0, null, and undefined as "not provided"
function optionalClean() {
  return z.any().transform((v) => {
    if (v === '' || v === null || v === undefined || v === 0) return undefined;
    return v;
  });
}

/**
 * Category chips shown on deal cards. Must stay in sync with the CHECK
 * constraint in supabase/migrations/011_add_deal_category.sql and with
 * web/src/lib/deal-category.ts.
 */
export const DEAL_CATEGORY_VALUES = [
  'beach',
  'nature',
  'hill',
  'river',
  'heritage',
  'adventure',
  'tour',
] as const;

/**
 * How a deal's description section is aligned on the deal page. Chosen per deal
 * by an admin, not by the page. Must stay in sync with the CHECK constraint in
 * supabase/migrations/013_add_deal_description_align.sql and with
 * web/src/lib/text-align.ts.
 */
export const DEAL_DESCRIPTION_ALIGN_VALUES = [
  'left',
  'center',
  'right',
  'justify',
] as const;

// One stop on a tour route.
//
// `name` is the free-text title the admin gives the stop and is what the public
// pages display; `address` is the separate, geocoded description of the point
// ("Bhulbaria, Santhia Upazila, Bangladesh") kept purely for reference. They are
// deliberately independent: renaming a stop must never be undone by a later
// re-snap, and a snapped stop must not force its address into the title.
//
// Every field has to be declared here — this schema strips unlisted keys before
// the insert, which is how stop images were being silently discarded.
const WaypointSchema = z.object({
  name: z.string().max(200).default(''),
  address: optionalClean().pipe(z.string().max(300).optional()),
  image: optionalClean().pipe(z.string().url().optional()),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const RouteGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2),
});

export const CreateDealSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  // Absent means "leave it as it is", which the column stores as null and every
  // reader draws as left. Declared here or the schema strips it before the
  // insert, silently discarding the admin's choice.
  description_align: optionalClean().pipe(z.enum(DEAL_DESCRIPTION_ALIGN_VALUES).optional()),
  short_description: optionalClean().pipe(z.string().max(300).optional()),
  destination: z.string().min(2),
  sub_destination: optionalClean().pipe(z.string().max(200).optional()),
  price: z.coerce.number().positive(),
  original_price: optionalClean().pipe(z.coerce.number().positive().optional()),
  duration_days: z.coerce.number().int().positive(),
  max_travelers: optionalClean().pipe(z.coerce.number().int().positive().optional()),
  image_url: optionalClean().pipe(z.string().url().optional()),
  // Empty string (the "auto-detect" choice in the admin form) is dropped so it
  // never reaches the enum or the nullable column.
  category: optionalClean().pipe(z.enum(DEAL_CATEGORY_VALUES).optional()),
  gallery: z.array(z.string().url()).optional().default([]).transform(v => v && v.length > 0 ? v : undefined),
  hidden_gallery: z.array(z.string().url()).optional().default([]).transform(v => v && v.length > 0 ? v : undefined),
  inclusions: z.array(z.string()).optional().default([]).transform(v => v && v.length > 0 ? v : undefined),
  exclusions: z.array(z.string()).optional().default([]).transform(v => v && v.length > 0 ? v : undefined),
  itinerary: z.array(z.object({
    // `phase` is the current field. `day` is still accepted from older admin
    // clients and from deals stored before the day -> phase rename.
    phase: z.coerce.number().positive().optional(),
    day: z.coerce.number().positive().optional(),
    title: z.string(),
    description: z.string(),
    // Must stay declared: unlisted keys are stripped before the insert.
    photos: z.array(z.string()).optional().default([]),
  })).optional(),
  route_waypoints: z.array(WaypointSchema).max(50).nullable().optional(),
  // Generated once in the admin form and persisted for public, routing-free rendering.
  route_geometry: RouteGeometrySchema.nullable().optional(),
  is_featured: z.boolean().optional(),
});

export const CreateCustomPackageSchema = z.object({
  title: z.string().max(200).optional(),
  destination_id: z.string().uuid(),
  budget: z.number().positive(),
  travel_date: z.string(),
  num_travelers: z.number().int().min(1).max(50),
  accommodation_type: z.enum(['budget', 'standard', 'luxury']),
  transport_type: z.enum(['flight', 'bus', 'train', 'self']),
  activities: z.array(z.string()).optional(),
  special_requests: z.string().max(2000).optional(),
});

export const CreateBookingSchema = z.object({
  booking_type: z.enum(['deal', 'custom']),
  deal_id: z.string().uuid().optional(),
  custom_package_id: z.string().uuid().optional(),
  total_amount: z.number().positive(),
  traveler_details: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    emergency_contact: z.string().optional(),
  }),
});

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'approved', 'rejected', 'cancelled']),
  admin_notes: z.string().optional(),
});

export const UpdateCustomPackageStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'approved', 'rejected']),
  admin_notes: z.string().optional(),
  estimated_price: z.number().positive().optional(),
});

export const UpdateAdminUserSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['bronze', 'platinum', 'gold', 'diamond']).optional(),
  pearls: z.number().int().min(0).optional(),
});

export const CreatePackageDestinationSchema = z.object({
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  value: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const UpdatePackageDestinationSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const BulkRemoveDealsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

// ── Geo proxy query params ─────────────────────────────────────────────────
// Query strings arrive as text, so numbers are coerced here rather than at the
// call site. Bounds keep one request from burning an unbounded amount of the
// Geoapify quota.

export const GeoSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
});

export const GeoReverseQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
});

export const CreateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
});

export const UpdateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(10).max(5000).optional(),
});

export const UpdateReviewStatusSchema = z.object({
  is_approved: z.boolean(),
});

/** `waypoints` is `lat,lon|lat,lon|...` — the same form Geoapify expects. */
export const GeoRouteQuerySchema = z.object({
  waypoints: z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      const parts = value.split('|');
      if (parts.length < 2 || parts.length > 25) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide between 2 and 25 waypoints',
        });
        return z.NEVER;
      }

      const points = parts.map((part) => {
        const [rawLat, rawLon] = part.split(',');
        const lat = Number(rawLat);
        const lon = Number(rawLon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid waypoint: ${part}`,
          });
          return z.NEVER;
        }
        return { lat, lon };
      });

      return points as { lat: number; lon: number }[];
    }),
  mode: z.enum(['drive', 'truck', 'walk', 'bicycle', 'scooter']).optional().default('drive'),
});
