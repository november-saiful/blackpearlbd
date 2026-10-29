import { describe, expect, it } from 'vitest';
import { dealSkeleton } from './skeleton';
import type { DealLike } from '../../src/lib/seo';

/** The smallest deal that still reaches the itinerary block. */
const withItinerary = (description: string): DealLike => ({
  title: 'Cox Bazar Coastal Escape',
  slug: 'coxs-bazar-3d-2n',
  duration_days: 3,
  price: 4800,
  itinerary: [{ phase: 1, title: 'Day 1', description }],
});

describe('dealSkeleton itinerary', () => {
  it('renders a hash bullet as a list item', () => {
    const html = dealSkeleton(withItinerary('# Breakfast at the hotel\n# Jeep to Nilgiri'));
    expect(html).toContain('<ul><li>Breakfast at the hotel</li><li>Jeep to Nilgiri</li></ul>');
  });

  it('renders a dash bullet as a list item', () => {
    const html = dealSkeleton(withItinerary('- Breakfast at the hotel'));
    expect(html).toContain('<ul><li>Breakfast at the hotel</li></ul>');
  });

  it('keeps prose in a paragraph', () => {
    const html = dealSkeleton(withItinerary('Breakfast at the hotel.'));
    expect(html).toContain('<p>Breakfast at the hotel.</p>');
  });
});
