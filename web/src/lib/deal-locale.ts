import { useMemo } from 'react';
import type { TourDeal } from '@/types';
import { getDealCategory } from '@/lib/deal-category';
import { humanizeDealText } from '@/lib/text';
import { useContentLocale, type ContentLocale } from '@/lib/locale';

type Text = string | null | undefined;
type TextList = string[] | null | undefined;

/**
 * Place labels the site already stores in one language. Destinations are held
 * as plain text on the deal (and managed from `package_destinations`), so the
 * translation lives here rather than in a parallel column: an admin still picks
 * one destination and both views can name it.
 */
const PLACE_NAMES: Array<[string, string]> = [
  ['Bangladesh', 'বাংলাদেশ'],
  ['Dhaka Division', 'ঢাকা বিভাগ'],
  ['Chattogram Division', 'চট্টগ্রাম বিভাগ'],
  ['Sylhet Division', 'সিলেট বিভাগ'],
  ['Khulna Division', 'খুলনা বিভাগ'],
  ['Rajshahi Division', 'রাজশাহী বিভাগ'],
  ['Barishal Division', 'বরিশাল বিভাগ'],
  ['Rangpur Division', 'রংপুর বিভাগ'],
  ['Mymensingh Division', 'ময়মনসিংহ বিভাগ'],
  ['Dhaka', 'ঢাকা'],
  ['Chattogram', 'চট্টগ্রাম'],
  ["Cox's Bazar", 'কক্সবাজার'],
  ['Sylhet', 'সিলেট'],
  ['Khulna', 'খুলনা'],
  ['Rajshahi', 'রাজশাহী'],
  ['Barishal', 'বরিশাল'],
  ['Rangpur', 'রংপুর'],
  ['Mymensingh', 'ময়মনসিংহ'],
  ['Munshiganj', 'মুন্সিগঞ্জ'],
  ['Manikganj', 'মানিকগঞ্জ'],
  ['Bandarban', 'বান্দরবান'],
  ['Rangamati', 'রাঙ্গামাটি'],
  ['Kuakata', 'কুয়াকাটা'],
  ['Sundarbans', 'সুন্দরবন'],
  ['Srimangal', 'শ্রীমঙ্গল'],
  ['Saint Martin', 'সেন্ট মার্টিন'],
  ["Saint Martin's Island", 'সেন্ট মার্টিন দ্বীপ'],
  ['Sonargaon', 'সোনারগাঁও'],
  ['Bagerhat', 'বাগেরহাট'],
  ['Paharpur', 'পাহাড়পুর'],
  ['Mahasthangarh', 'মহাস্থানগড়'],
  ['Thailand', 'থাইল্যান্ড'],
  ['India', 'ভারত'],
  ['Kashmir', 'কাশ্মীর'],
  ['Nepal', 'নেপাল'],
  ['Bhutan', 'ভুটান'],
  ['Sri Lanka', 'শ্রীলঙ্কা'],
  ['Maldives', 'মালদ্বীপ'],
  ['Malaysia', 'মালয়েশিয়া'],
  ['Singapore', 'সিঙ্গাপুর'],
  ['Indonesia', 'ইন্দোনেশিয়া'],
  ['Vietnam', 'ভিয়েতনাম'],
  ['China', 'চীন'],
  ['Japan', 'জাপান'],
  ['Turkey', 'তুরস্ক'],
  ['Egypt', 'মিশর'],
  ['Dubai', 'দুবাই'],
  ['United Arab Emirates', 'সংযুক্ত আরব আমিরাত'],
  ['Saudi Arabia', 'সৌদি আরব'],
  ['Qatar', 'কাতার'],
  ['Oman', 'ওমান'],
];

const PLACE_INDEX = new Map<string, { en: string; bn: string }>();
for (const [en, bn] of PLACE_NAMES) {
  const entry = { en, bn };
  PLACE_INDEX.set(en.toLowerCase(), entry);
  PLACE_INDEX.set(bn, entry);
}

/** Names a place in the chosen language, leaving unknown labels untouched. */
export function localizePlaceName(value: string, locale: ContentLocale): string {
  const key = value.trim().toLowerCase().replace(/[’‘]/g, "'");
  const entry = PLACE_INDEX.get(key);
  if (!entry) return value;
  return locale === 'bn' ? entry.bn : entry.en;
}

function pick(locale: ContentLocale, en: Text, bn: Text): string | null {
  const ordered = locale === 'bn' ? [bn, en] : [en, bn];
  for (const value of ordered) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function pickText(locale: ContentLocale, en: Text, bn: Text, fallback: string): string {
  return pick(locale, en, bn) ?? fallback;
}

function pickOptionalText(
  locale: ContentLocale,
  en: Text,
  bn: Text,
  fallback: Text,
): string | null {
  return pick(locale, en, bn) ?? fallback ?? null;
}

function pickList(
  locale: ContentLocale,
  en: TextList,
  bn: TextList,
  fallback: TextList,
): string[] {
  const ordered = locale === 'bn' ? [bn, en] : [en, bn];
  for (const value of ordered) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return fallback ?? [];
}

/**
 * Returns the deal with every piece of prose copied into its canonical fields
 * for the chosen language, keeping the per-language originals in place.
 *
 * Fallbacks are deliberate: a deal written only in Bengali still renders in the
 * English view (and vice versa) rather than showing an empty card, and the
 * canonical column catches rows saved before translations existed.
 */
export function localizeDeal(deal: TourDeal, locale: ContentLocale): TourDeal {
  // Category detection reads the canonical text; deriving it before the copy is
  // replaced keeps the chip stable when the two languages classify differently.
  const category = deal.category ?? getDealCategory(deal).key;

  return {
    ...deal,
    title: pickText(locale, deal.title_en, deal.title_bn, deal.title),
    short_description: pickOptionalText(
      locale,
      deal.short_description_en,
      deal.short_description_bn,
      deal.short_description,
    ),
    description: pickOptionalText(
      locale,
      deal.description_en,
      deal.description_bn,
      deal.description,
    ),
    inclusions: pickList(locale, deal.inclusions_en, deal.inclusions_bn, deal.inclusions),
    exclusions: pickList(locale, deal.exclusions_en, deal.exclusions_bn, deal.exclusions),
    destination: localizePlaceName(deal.destination, locale),
    sub_destination: deal.sub_destination
      ? localizePlaceName(deal.sub_destination, locale)
      : deal.sub_destination,
    category,
    itinerary: deal.itinerary.map((phase) => ({
      ...phase,
      title: pickText(locale, phase.title_en, phase.title_bn, phase.title),
      description: pickText(locale, phase.description_en, phase.description_bn, phase.description),
    })),
    route_waypoints:
      deal.route_waypoints?.map((waypoint) => ({
        ...waypoint,
        name: pickText(locale, waypoint.name_en, waypoint.name_bn, waypoint.name),
      })) ?? deal.route_waypoints,
  };
}

/** Localizes one deal and applies the site's dash cleanup to the result. */
export function useLocalizedDeal(deal: TourDeal | null | undefined): TourDeal | null | undefined {
  const { locale } = useContentLocale();
  return useMemo(
    () => (deal ? humanizeDealText(localizeDeal(deal, locale)) : deal),
    [deal, locale],
  );
}

/** Localizes a list of deals while keeping their order and identity per locale. */
export function useLocalizedDeals(deals: TourDeal[]): TourDeal[] {
  const { locale } = useContentLocale();
  return useMemo(
    () => deals.map((deal) => humanizeDealText(localizeDeal(deal, locale))),
    [deals, locale],
  );
}
