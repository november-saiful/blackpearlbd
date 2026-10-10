import { useQuery } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDeals() {
  const dealsQuery = useQuery({
    queryKey: ['deals'],
    queryFn: () => api.getDeals(),
  });

  return {
    deals: dealsQuery.data?.deals || [],
    isLoading: dealsQuery.isLoading,
  };
}

/**
 * Fetch the public deals list in parallel with the item-level queries that
 * depend on it (related deals, reviews, featured slices). All of these hit the
 * Worker which pre-warms its edge cache at request time, so after the first
 * visit every subsequent page load reads from the cache instead of the
 * Postgres database.
 */
export function useDealsParallel() {
  return useQueries({
    queries: [
      { queryKey: ['deals'], queryFn: () => api.getDeals(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['deal-reviews'], queryFn: () => api.getDealReviews(''), staleTime: 5 * 60 * 1000 },
      { queryKey: ['related-deals'], queryFn: () => api.getRelatedDeals(''), staleTime: 5 * 60 * 1000 },
    ] as const,
  });
}

export function useDeal(slug: string) {
  const dealQuery = useQuery({
    queryKey: ['deal', slug],
    queryFn: () => api.getDeal(slug),
    enabled: !!slug,
  });

  return {
    deal: dealQuery.data?.deal,
    isLoading: dealQuery.isLoading,
  };
}
