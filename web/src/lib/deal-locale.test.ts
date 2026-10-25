import { describe, expect, it } from 'vitest';
import { localizeDeal, localizePlaceName } from './deal-locale';
import type { TourDeal } from '@/types';

function makeDeal(overrides: Partial<TourDeal> = {}): TourDeal {
  return {
    id: 'deal-1',
    deal_code: null,
    title: 'Canonical title',
    slug: 'canonical-title',
    description: 'Canonical description',
    short_description: 'Canonical short',
    destination: 'Bangladesh',
    sub_destination: null,
    description_align: null,
    category: null,
    price: 1000,
    original_price: null,
    duration_days: 1,
    max_travelers: null,
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
    avg_rating: null,
    review_count: 0,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('localizeDeal', () => {
  it('picks the copy for the chosen language', () => {
    const deal = makeDeal({
      title_en: 'English title',
      title_bn: 'বাংলা শিরোনাম',
      description_en: 'English description',
      description_bn: 'বাংলা বিবরণ',
      short_description_en: 'English short',
      short_description_bn: 'বাংলা সংক্ষেপ',
    });

    expect(localizeDeal(deal, 'en')).toMatchObject({
      title: 'English title',
      description: 'English description',
      short_description: 'English short',
    });
    expect(localizeDeal(deal, 'bn')).toMatchObject({
      title: 'বাংলা শিরোনাম',
      description: 'বাংলা বিবরণ',
      short_description: 'বাংলা সংক্ষেপ',
    });
  });

  it('falls back to the other language when one is empty', () => {
    const onlyBengali = makeDeal({ title_en: null, title_bn: 'বাংলা শিরোনাম' });
    const onlyEnglish = makeDeal({ title_en: 'English title', title_bn: null });

    expect(localizeDeal(onlyBengali, 'en').title).toBe('বাংলা শিরোনাম');
    expect(localizeDeal(onlyEnglish, 'bn').title).toBe('English title');
  });

  it('falls back to the canonical columns for rows saved before translations', () => {
    const legacy = makeDeal({ title: 'Legacy title', description: 'Legacy description' });

    expect(localizeDeal(legacy, 'en')).toMatchObject({
      title: 'Legacy title',
      description: 'Legacy description',
    });
    expect(localizeDeal(legacy, 'bn').title).toBe('Legacy title');
  });

  it('localizes itinerary phases and route stops', () => {
    const deal = makeDeal({
      itinerary: [
        {
          phase: 1,
          title: 'Arrival',
          title_en: 'Arrival',
          title_bn: 'আগমন',
          description: 'Meet the guide',
          description_en: 'Meet the guide',
          description_bn: 'গাইডের সাথে দেখা করুন',
          photos: [],
        },
      ],
      route_waypoints: [
        { name: 'Airport', name_en: 'Airport', name_bn: 'বিমানবন্দর', lat: 23.8, lng: 90.4 },
      ],
    });

    const bengali = localizeDeal(deal, 'bn');
    expect(bengali.itinerary[0]).toMatchObject({
      title: 'আগমন',
      description: 'গাইডের সাথে দেখা করুন',
    });
    expect(bengali.route_waypoints?.[0].name).toBe('বিমানবন্দর');

    const english = localizeDeal(deal, 'en');
    expect(english.itinerary[0].title).toBe('Arrival');
    expect(english.route_waypoints?.[0].name).toBe('Airport');
  });

  it('prefers translated lists but keeps the canonical list as fallback', () => {
    const deal = makeDeal({
      inclusions: ['Canonical inclusion'],
      inclusions_en: ['Breakfast', 'Transport'],
      inclusions_bn: ['সকালের নাশতা', 'যাতায়াত'],
      exclusions_en: [],
      exclusions_bn: [],
      exclusions: ['Canonical exclusion'],
    });

    expect(localizeDeal(deal, 'en').inclusions).toEqual(['Breakfast', 'Transport']);
    expect(localizeDeal(deal, 'bn').inclusions).toEqual(['সকালের নাশতা', 'যাতায়াত']);
    expect(localizeDeal(deal, 'bn').exclusions).toEqual(['Canonical exclusion']);
  });

  it('keeps the auto-detected category based on the canonical copy', () => {
    const deal = makeDeal({
      title: 'Cox’s Bazar beach escape',
      title_bn: 'কক্সবাজার সমুদ্র সৈকত',
      category: null,
    });

    expect(localizeDeal(deal, 'bn').category).toBe('beach');
  });
});

describe('localizePlaceName', () => {
  it('names known places in both languages', () => {
    expect(localizePlaceName('Cox’s Bazar', 'bn')).toBe('কক্সবাজার');
    expect(localizePlaceName('কক্সবাজার', 'en')).toBe("Cox's Bazar");
  });

  it('leaves unknown place labels untouched', () => {
    expect(localizePlaceName('Somewhere New', 'bn')).toBe('Somewhere New');
  });
});
