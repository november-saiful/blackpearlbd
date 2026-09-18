export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BLACKPEARL_BUCKET?: R2Bucket;
  /**
   * Geoapify key for place search, routing and reverse geocoding. Optional so
   * the API still boots without it — the /geo routes report 503 instead.
   */
  GEOAPIFY_API_KEY?: string;
}

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

export interface TourDeal {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  /** Alignment of the description section; null reads as left. */
  description_align: string | null;
  short_description: string | null;
  destination: string;
  /** Deal card category chip; null until an admin picks one. */
  category: string | null;
  price: number;
  original_price: number | null;
  duration_days: number;
  max_travelers: number | null;
  image_url: string | null;
  gallery: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryPhase[];
  is_active: boolean;
  is_featured: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One step of a tour itinerary — not necessarily a calendar day. */
export interface ItineraryPhase {
  /** 1-based position within the tour. */
  phase?: number;
  /** Legacy field name kept for rows written before the day -> phase rename. */
  day?: number;
  title: string;
  description: string;
  photos?: string[];
}

export interface CustomPackage {
  id: string;
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
}

export interface SavedDeal {
  id: string;
  user_id: string;
  deal_id: string;
  created_at: string;
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
}

export interface DestinationTree extends Destination {
  children: DestinationTree[];
}
