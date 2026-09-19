import { describe, expect, it } from 'vitest';
import type { TourDeal } from '@/types';

/** A whole deal, so no test has to cast a partial. */
function deal(overrides: Partial<TourDeal> = {}): TourDeal {
  return {
    id: 'deal-1',
    deal_code: 'BP-1',
    title: 'Kuakata Sea & Heritage Tour',
    slug: 'kuakata-sea',
    description: 'A three day trip',
    description_align: null,
    short_description: 'Sunrise and sunset over the bay',
    destination: 'Kuakata',
    category: 'beach',
    price: 9800,
    original_price: 12000,
    duration_days: 3,
    max_travelers: 20,
    image_url: null,
    gallery: [],
    hidden_gallery: [],
    inclusions: [],
    exclusions: [],
    itinerary: [],
    route_waypoints: null,
    route_geometry: null,
    is_active: true,
    is_featured: false,
    avg_rating: 0,
    review_count: 0,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
