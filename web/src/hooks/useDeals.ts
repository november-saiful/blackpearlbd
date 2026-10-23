import { useQuery } from '@tanstack/react-query';
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
