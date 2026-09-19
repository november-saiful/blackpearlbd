import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import type { Review, ReviewStats } from '../types';

export function useDealReviews(slug: string) {
  const query = useQuery({
    queryKey: ['deal-reviews', slug],
    queryFn: () => api.getDealReviews(slug),
    enabled: !!slug,
  });

  return {
    reviews: query.data?.reviews || [],
    stats: query.data?.stats || { avg_rating: 0, review_count: 0, distribution: [0, 0, 0, 0, 0] },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useCreateReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; title: string; body: string }) =>
      api.createReview(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-reviews', slug] });
      toast.success('Review submitted! It will appear after approval.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit review');
    },
  });
}

export function useUpdateReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { rating?: number; title?: string; body?: string } }) =>
      api.updateReview(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-reviews', slug] });
      toast.success('Review updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update review');
    },
  });
}

export function useDeleteReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-reviews', slug] });
      toast.success('Review deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete review');
    },
  });
}
