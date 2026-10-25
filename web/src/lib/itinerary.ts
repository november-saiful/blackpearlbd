import type { ItineraryPhase, TourDeal } from '@/types';

/**
 * Itinerary entries used to be stored as days (`{ day, title, description }`).
 * They are now phases (a one-day tour can have several phases), so rows written
 * before the rename still carry `day` and have no `photos`. Normalize on every
 * read so the rest of the app can rely on the `ItineraryPhase` shape.
 */
export function normalizeItinerary(raw: unknown): ItineraryPhase[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, index) => {
      const position = Number(entry.phase ?? entry.day);
      const translation = (key: string) =>
        typeof entry[key] === 'string' ? { [key]: entry[key] as string } : {};
      return {
        phase: Number.isFinite(position) && position > 0 ? position : index + 1,
        title: typeof entry.title === 'string' ? entry.title : '',
        description: typeof entry.description === 'string' ? entry.description : '',
        photos: Array.isArray(entry.photos)
          ? entry.photos.filter((photo): photo is string => typeof photo === 'string')
          : [],
        ...translation('title_en'),
        ...translation('title_bn'),
        ...translation('description_en'),
        ...translation('description_bn'),
      };
    });
}

/** Applies {@link normalizeItinerary} to a deal fetched from the API. */
export function normalizeDeal(deal: TourDeal): TourDeal {
  return { ...deal, itinerary: normalizeItinerary(deal.itinerary) };
}
