import { useMemo } from 'react';
import { useDeals } from './useDeals';
import { getDealCategory } from '@/lib/deal-category';
import type { TourDeal } from '@/types';

const MAX_RELATED = 4;
const PRICE_RANGE_RATIO = 0.35; // within ±35 % of current price

/**
 * Returns up to `MAX_RELATED` deals that are related to the given deal.
 *
 * Priority order:
 *  1. Deals in the **same category** (closest price first).
 *  2. Deals with a **similar price** (within PRICE_RANGE_RATIO).
 *  3. Most **recent** active deals (newest first).
 *
 * The current deal is always excluded from the results.
 */
export function useRelatedDeals(currentDeal: TourDeal | undefined) {
  const { deals, isLoading } = useDeals();

  const related = useMemo<TourDeal[]>(() => {
    if (!currentDeal) return [];

    const others = deals.filter((d) => d.id !== currentDeal.id && d.is_active);
    if (others.length === 0) return [];

    const currentCategory = getDealCategory(currentDeal).key;

    // 1. Same category, sorted by closest price
    const sameCategory = others
      .filter((d) => getDealCategory(d).key === currentCategory)
      .sort((a, b) => Math.abs(a.price - currentDeal.price) - Math.abs(b.price - currentDeal.price));

    if (sameCategory.length >= MAX_RELATED) {
      return sameCategory.slice(0, MAX_RELATED);
    }

    // 2. Nearby price (excluding already-picked)
    const pickedIds = new Set(sameCategory.map((d) => d.id));
    const priceLow = currentDeal.price * (1 - PRICE_RANGE_RATIO);
    const priceHigh = currentDeal.price * (1 + PRICE_RANGE_RATIO);

    const nearbyPrice = others
      .filter((d) => !pickedIds.has(d.id) && d.price >= priceLow && d.price <= priceHigh)
      .sort((a, b) => Math.abs(a.price - currentDeal.price) - Math.abs(b.price - currentDeal.price));

    const combined = [...sameCategory, ...nearbyPrice];
    if (combined.length >= MAX_RELATED) {
      return combined.slice(0, MAX_RELATED);
    }

    // 3. Most recent (excluding already-picked)
    const pickedIds2 = new Set(combined.map((d) => d.id));
    const recent = others
      .filter((d) => !pickedIds2.has(d.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return [...combined, ...recent].slice(0, MAX_RELATED);
  }, [currentDeal, deals]);

  return { related, isLoading };
}
