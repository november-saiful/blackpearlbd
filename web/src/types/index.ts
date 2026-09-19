export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  pearls: number;
  status: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Waypoint {
  /**
   * Free-text title the admin assigns to this stop, shown on the tour route map
   * and the stop list. Independent of where the pin actually sits — `address`
   * carries the geocoded description.
   */
  name: string;
  /** Geocoded description of the point, e.g. "Bhulbaria, Santhia Upazila, Bangladesh". */
  address?: string;
  lat: number;
  lng: number;
  /** Gallery image URL shown as this stop's polaroid on the route map. */
  image?: string;
}

/** GeoJSON LineString describing a driving route between waypoints. */
export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

/**
 * A geocoding hit from the Worker's `/geo` proxy. The Worker flattens the
 * provider's payload into this shape, so nothing here is provider-specific.
 */
export interface GeoPlace {
  id: string | null;
  name: string;
  /** Full formatted address, e.g. "Cox's Bazar District, Chattogram Division, Bangladesh". */
  address: string;
  lat: number;
  lon: number;
}

/** Result of `/geo/route`: the polyline plus Geoapify's distance (m) and time (s). */
export interface GeoRoute {
  geometry: RouteGeometry | null;
  distance: number;
  time: number;
}

/** Result of `POST /geo/cache-purge`, describing what was actually discarded. */
export interface GeoCachePurgeResult {
  isolateEntriesCleared: number;
  edgeKeysAttempted: number;
  edgeEntriesDeleted: number;
  truncated: boolean;
  edgeCacheAvailable: boolean;
  note: string;
}

export interface TourDeal {
  id: string;
  deal_code: string | null;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  destination: string;
  /**
   * Alignment of the About section ('left', 'center', 'right', 'justify'); null
   * on every deal saved before the choice existed, which reads as left.
   */
  description_align: string | null;
  /** Deal card category key ('beach', 'nature', ...); null = auto-detect. */
  category: string | null;
  price: number;
  original_price: number | null;
  duration_days: number;
  max_travelers: number | null;
  image_url: string | null;
  gallery: string[];
  /** Gallery images excluded from the deal-page carousel. */
  hidden_gallery: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryPhase[];
  route_waypoints: Waypoint[] | null;
  route_geometry: RouteGeometry | null;
  is_active: boolean;
  is_featured: boolean;
  avg_rating: number | null;
  review_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  deal_id: string;
  booking_id: string | null;
  rating: number;
  title: string;
  body: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  user?: { full_name: string | null; avatar_url: string | null };
  deal?: { title: string; slug: string };
}

export interface ReviewStats {
  avg_rating: number;
  review_count: number;
  distribution: number[];
}

/**
 * One step of a tour itinerary. Deliberately not a calendar day: a one-day tour
 * can have several phases (pickup, harbour cruise, sunset dinner, ...).
 * `phase` is the 1-based position of the step within the tour.
 */
export interface ItineraryPhase {
  phase: number;
  title: string;
  description: string;
  photos: string[];
}

export interface CustomPackage {
  id: string;
  package_code: string | null;
  user_id: string;
  title: string | null;
  destination_id: string | null;
  budget: number | null;
  travel_date: string | null;
  num_travelers: number;
  accommodation_type: string | null;
  transport_type: string | null;
  activities: string[];
  special_requests: string | null;
  estimated_price: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string };
}

export interface Booking {
  id: string;
  user_id: string;
  booking_type: string;
  deal_id: string | null;
  custom_package_id: string | null;
  status: string;
  total_amount: number;
  traveler_details: Record<string, unknown>;
  invoice_number: string | null;
  invoice_url: string | null;
  payment_status: string;
  booked_at: string;
  updated_at: string;
  deal?: TourDeal;
  custom_package?: CustomPackage;
  user?: { full_name: string; email: string };
}

export interface SavedDeal {
  id: string;
  user_id: string;
  deal_id: string;
  created_at: string;
  deal?: TourDeal;
}

export interface PearlsHistory {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  booking_id: string | null;
  created_at: string;
}

export interface Destination {
  id: string;
  name: string;
  parent_id: string | null;
  type: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  children?: Destination[];
}

export interface ProfileStats {
  pearls: number;
  status: string;
  totalTours: number;
  pendingBookings: number;
}

export interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  pendingApprovals: number;
}

export interface PackageDestination {
  id: string;
  category: string;
  name: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PackageDistrict {
  id: string;
  division_value: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PackageTourSpot {
  id: string;
  district_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  district?: { name: string; division_value: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
