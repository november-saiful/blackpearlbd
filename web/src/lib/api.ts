import { normalizeDeal } from './itinerary';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * API failure carrying the HTTP status, for callers that must distinguish
 * "the request was rejected" (e.g. an unroutable waypoint) from "the service
 * is unavailable" (misconfiguration, expired session, rate limit).
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const details = error.details ? `: ${JSON.stringify(error.details)}` : '';
    throw new ApiError(`${error.error || `HTTP ${response.status}`}${details}`, response.status);
  }

  return response.json();
}

export const api = {
  // Auth
  getSession: () => fetchApi<{ user: { id: string }; profile: Profile }>('/auth/session'),

  // Profile
  getProfile: () => fetchApi<{ profile: Profile }>('/profile'),
  updateProfile: (data: Partial<Profile>) =>
    fetchApi<{ profile: Profile }>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  getProfileStats: () => fetchApi<ProfileStats>('/profile/stats'),
  getProfileTours: () => fetchApi<{ tours: Booking[] }>('/profile/tours'),
  getProfilePending: () => fetchApi<{ bookings: Booking[] }>('/profile/pending'),
  getProfilePearls: () => fetchApi<{ history: PearlsHistory[] }>('/profile/pearls'),

  // Upload
  uploadImage: async (file: File): Promise<{ url: string; key: string }> => {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/upload/image`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `Upload failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  // Deals
  getDeals: () =>
    fetchApi<{ deals: TourDeal[] }>('/deals').then((res) => ({ deals: res.deals.map(normalizeDeal) })),
  getDeal: (slug: string) =>
    fetchApi<{ deal: TourDeal }>(`/deals/${slug}`).then((res) => ({ deal: normalizeDeal(res.deal) })),
  createDeal: (data: Partial<TourDeal>) =>
    fetchApi<{ deal: TourDeal }>('/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id: string, data: Partial<TourDeal>) =>
    fetchApi<{ deal: TourDeal }>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeal: (id: string) =>
    fetchApi(`/deals/${id}`, { method: 'DELETE' }),
  bulkRemoveDeals: (ids: string[]) =>
    fetchApi<{ removed: number; failed: number; results: Array<{ id: string; status: string; images?: number; message?: string }> }>(
      '/deals/bulk-remove',
      { method: 'POST', body: JSON.stringify({ ids }) },
    ),

  // Geo — place search, reverse geocoding and routing, proxied through the
  // Worker so the Geoapify key never ships to the browser. Admin-only.
  // `refresh` forces a fresh upstream lookup instead of a cached one.
  searchPlaces: (query: string, limit = 5, refresh = false) =>
    fetchApi<{ places: GeoPlace[] }>(
      `/geo/search?q=${encodeURIComponent(query)}&limit=${limit}${refresh ? '&refresh=1' : ''}`,
    ),
  reverseGeocode: (lat: number, lon: number, refresh = false) =>
    fetchApi<{ place: GeoPlace | null }>(
      `/geo/reverse?lat=${lat}&lon=${lon}${refresh ? '&refresh=1' : ''}`,
    ),
  generateRoute: (waypoints: string, mode = 'drive') =>
    fetchApi<GeoRoute>(`/geo/route?waypoints=${encodeURIComponent(waypoints)}&mode=${mode}`),
  purgeGeoCache: () => fetchApi<GeoCachePurgeResult>('/geo/cache-purge', { method: 'POST' }),

  // Custom Packages
  getDestinations: () => fetchApi<{ destinations: Destination[] }>('/custom-packages/destinations'),
  createCustomPackage: (data: Partial<CustomPackage>) =>
    fetchApi<{ customPackage: CustomPackage }>('/custom-packages', { method: 'POST', body: JSON.stringify(data) }),
  getCustomPackages: () => fetchApi<{ customPackages: CustomPackage[] }>('/custom-packages'),
  getCustomPackage: (id: string) =>
    fetchApi<{ customPackage: CustomPackage }>(`/custom-packages/${id}`),
  bookCustomPackage: (id: string, data: { traveler_details: Record<string, unknown> }) =>
    fetchApi<{ booking: Booking }>(`/custom-packages/${id}/book`, { method: 'POST', body: JSON.stringify(data) }),

  // Bookings
  createBooking: (data: Partial<Booking>) =>
    fetchApi<{ booking: Booking }>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getBookings: () => fetchApi<{ bookings: Booking[] }>('/bookings'),
  getInvoice: (id: string) => fetchApi<{ invoice: Booking }>(`/bookings/${id}/invoice`),

  // Saved Deals
  getSavedDeals: () => fetchApi<{ savedDeals: SavedDeal[] }>('/saved-deals'),
  saveDeal: (dealId: string) =>
    fetchApi<{ savedDeal: SavedDeal }>('/saved-deals', { method: 'POST', body: JSON.stringify({ deal_id: dealId }) }),
  unsaveDeal: (id: string) =>
    fetchApi(`/saved-deals/${id}`, { method: 'DELETE' }),

  // Package Destinations (public)
  getPackageDestinations: () =>
    fetchApi<{ destinations: PackageDestination[] }>('/custom-packages/package-destinations'),

  // Reviews
  getDealReviews: (slug: string) =>
    fetchApi<{ reviews: Review[]; stats: ReviewStats }>(`/reviews/deals/${slug}`),
  createReview: (slug: string, data: { rating: number; title: string; body: string }) =>
    fetchApi<{ review: Review }>(`/reviews/deals/${slug}`, { method: 'POST', body: JSON.stringify(data) }),
  updateReview: (id: string, data: { rating?: number; title?: string; body?: string }) =>
    fetchApi<{ review: Review }>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReview: (id: string) =>
    fetchApi(`/reviews/${id}`, { method: 'DELETE' }),

  // Admin Reviews
  getAdminReviews: (page = 1) =>
    fetchApi<{ reviews: Review[]; total: number; totalPages: number }>(`/reviews/admin?page=${page}`),
  updateReviewStatus: (id: string, is_approved: boolean) =>
    fetchApi<{ review: Review }>(`/reviews/admin/${id}`, { method: 'PATCH', body: JSON.stringify({ is_approved }) }),

  // Admin
  getAdminStats: () => fetchApi<{ stats: AdminStats; recentBookings: Booking[] }>('/admin/stats'),
  getAdminUsers: (page = 1, search = '') =>
    fetchApi<{ users: Profile[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/users?page=${page}&search=${search}`
    ),
  updateAdminUser: (id: string, data: { full_name?: string; role?: string; status?: string; pearls?: number }) =>
    fetchApi<{ user: Profile }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAdminUser: (id: string) =>
    fetchApi(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminBookings: (page = 1, status?: string, type?: string) => {
    let url = `/admin/bookings?page=${page}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;
    return fetchApi<{ bookings: Booking[]; total: number; page: number; limit: number; totalPages: number }>(url);
  },
  updateBookingStatus: (id: string, data: { status: string; admin_notes?: string }) =>
    fetchApi<{ booking: Booking }>(`/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBooking: (id: string) =>
    fetchApi(`/admin/bookings/${id}`, { method: 'DELETE' }),
  getAdminCustomPackages: (page = 1) =>
    fetchApi<{ customPackages: CustomPackage[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/custom-packages?page=${page}`
    ),
  updateCustomPackageStatus: (id: string, data: { status: string; admin_notes?: string; estimated_price?: number }) =>
    fetchApi<{ customPackage: CustomPackage }>(`/admin/custom-packages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin Package Destinations
  getAdminPackageDestinations: () =>
    fetchApi<{ destinations: PackageDestination[] }>('/admin/package-destinations'),
  createPackageDestination: (data: { category: string; name: string; value: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ destination: PackageDestination }>('/admin/package-destinations', { method: 'POST', body: JSON.stringify(data) }),
  updatePackageDestination: (id: string, data: { category?: string; name?: string; value?: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ destination: PackageDestination }>(`/admin/package-destinations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackageDestination: (id: string) =>
    fetchApi(`/admin/package-destinations/${id}`, { method: 'DELETE' }),

  // Admin Package Districts
  getAdminPackageDistricts: (division?: string) => {
    const q = division ? `?division=${encodeURIComponent(division)}` : '';
    return fetchApi<{ districts: PackageDistrict[] }>(`/admin/package-districts${q}`);
  },
  createPackageDistrict: (data: { division_value: string; name: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ district: PackageDistrict }>('/admin/package-districts', { method: 'POST', body: JSON.stringify(data) }),
  updatePackageDistrict: (id: string, data: { name?: string; division_value?: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ district: PackageDistrict }>(`/admin/package-districts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackageDistrict: (id: string) =>
    fetchApi(`/admin/package-districts/${id}`, { method: 'DELETE' }),

  // Admin Package Tour Spots
  getAdminPackageTourSpots: (districtId?: string) => {
    const q = districtId ? `?district_id=${encodeURIComponent(districtId)}` : '';
    return fetchApi<{ tourSpots: PackageTourSpot[] }>(`/admin/package-tour-spots${q}`);
  },
  createPackageTourSpot: (data: { district_id: string; name: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ tourSpot: PackageTourSpot }>('/admin/package-tour-spots', { method: 'POST', body: JSON.stringify(data) }),
  updatePackageTourSpot: (id: string, data: { name?: string; district_id?: string; sort_order?: number; is_active?: boolean }) =>
    fetchApi<{ tourSpot: PackageTourSpot }>(`/admin/package-tour-spots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackageTourSpot: (id: string) =>
    fetchApi(`/admin/package-tour-spots/${id}`, { method: 'DELETE' }),
};

// Import types at the top level for convenience
import type { Profile, TourDeal, CustomPackage, Booking, SavedDeal, PearlsHistory, Destination, ProfileStats, AdminStats, PackageDestination, PackageDistrict, PackageTourSpot, GeoPlace, GeoRoute, GeoCachePurgeResult, Review, ReviewStats } from '../types';
