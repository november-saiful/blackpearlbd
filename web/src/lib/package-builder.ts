import type { CustomPackage } from '@/types';

/**
 * Shared vocabulary and request shaping for the 3-step package builder.
 *
 * The option values here must stay in sync with `CreateCustomPackageSchema` in
 * worker/src/lib/validators.ts — the worker rejects anything outside these
 * enums, so a mismatch shows up as a failed submit rather than a type error.
 */

export const ACCOMMODATION_TYPES = [
  { value: 'budget', label: 'Budget', hint: 'Guesthouse or simple hotel' },
  { value: 'standard', label: 'Standard', hint: 'Comfortable 3-star stay' },
  { value: 'luxury', label: 'Luxury', hint: '4-5 star hotel or resort' },
] as const;

export const TRANSPORT_TYPES = [
  { value: 'flight', label: 'Flight', hint: 'Fly between stops' },
  { value: 'bus', label: 'Bus', hint: 'Intercity coach' },
  { value: 'train', label: 'Train', hint: 'Rail where available' },
  { value: 'self', label: 'Self', hint: 'Arrange your own transport' },
] as const;

/** One-tap activity chips; travellers can also type their own in step 2. */
export const ACTIVITY_OPTIONS = [
  'Sightseeing',
  'Beach & water',
  'Hiking & trekking',
  'Local food tour',
  'Photography',
  'Shopping',
  'Heritage & museums',
  'Boat or cruise',
  'Culture & nightlife',
  'Adventure sports',
  'Wildlife & nature',
  'Wellness & spa',
] as const;

export const MAX_TRAVELERS = 50;
export const MAX_ACTIVITIES = 30;
export const MAX_SPECIAL_REQUESTS = 2000;

/** Everything the builder collects, in the form the request is built from. */
export type PackageDraft = {
  /** package_destinations.value slug, e.g. 'thailand' or 'dhaka-division'. */
  destinationValue: string;
  /** Display name of the destination, or the customized-Bangladesh label. */
  destinationLabel: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  division: string;
  districts: string[];
  tourSpots: string[];
  numTravelers: number;
  accommodationType: string;
  transportType: string;
  budget: number;
  activities: string[];
  specialRequests: string;
};

/** `YYYY-MM-DD` from the picker's parts, which arrive unpadded. */
export function toIsoDate(parts: { year: string; month: string; day: string }): string {
  const pad = (value: string) => value.padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * Title shown in the admin queue's Destination column and on the traveller's
 * own package card. Falls back gracefully because the destination list is
 * admin-managed and can change between sessions.
 */
export function buildPackageTitle(
  draft: Pick<PackageDraft, 'destinationLabel' | 'division' | 'districts'>,
): string {
  const parts = [draft.destinationLabel.trim() || 'Custom package'];
  if (draft.division) parts.push(`· ${draft.division}`);
  if (draft.districts.length > 0) parts.push(`(${draft.districts.join(', ')})`);
  return parts.join(' ').slice(0, 200);
}

/** Step 2 is only finished once every field the API requires has a value. */
export function isPreferencesComplete(draft: {
  numTravelers: number;
  accommodationType: string;
  transportType: string;
  budget: number;
}): boolean {
  return (
    Number.isInteger(draft.numTravelers) &&
    draft.numTravelers >= 1 &&
    draft.numTravelers <= MAX_TRAVELERS &&
    draft.accommodationType !== '' &&
    draft.transportType !== '' &&
    Number.isFinite(draft.budget) &&
    draft.budget > 0
  );
}

/**
 * Request body for POST /custom-packages.
 *
 * Optional values are omitted rather than sent as empty strings: the worker
 * schema types `division` and `special_requests` as strings and would reject
 * or store `''`, and `return_date` is only meaningful for a real range.
 */
export function buildCustomPackagePayload(draft: PackageDraft): Partial<CustomPackage> {
  const requests = draft.specialRequests.trim();
  return {
    title: buildPackageTitle(draft),
    destination_value: draft.destinationValue,
    budget: draft.budget,
    travel_date: draft.fromDate,
    return_date: draft.toDate && draft.toDate !== draft.fromDate ? draft.toDate : undefined,
    num_travelers: draft.numTravelers,
    accommodation_type: draft.accommodationType,
    transport_type: draft.transportType,
    activities: draft.activities.slice(0, MAX_ACTIVITIES),
    division: draft.division || undefined,
    districts: draft.districts,
    tour_spots: draft.tourSpots,
    special_requests: requests ? requests.slice(0, MAX_SPECIAL_REQUESTS) : undefined,
  };
}
