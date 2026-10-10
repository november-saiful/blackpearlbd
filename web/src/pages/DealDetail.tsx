import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DealDetail as DealDetailComponent } from '@/components/deals/DealDetail';
import { useRelatedDeals } from '@/hooks/useRelatedDeals';
import { Loader2 } from 'lucide-react';
import { applyDealMeta } from '@/components/layout/PageTitle';
import { formatDealLocation } from '@/components/deals/deals-destination';

export default function DealDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  // Parallelise the independent reads: the deal itself, its reviews and the
  // sibling deals shown on the side. The Worker pre-warms and serves these
  // from its edge cache, so this block resolves in one round trip.
  const queries = useQueries({
    queries: [
      { queryKey: ['deal', slug], queryFn: () => api.getDeal(slug || ''), staleTime: 5 * 60 * 1000 },
      { queryKey: ['deal-reviews', slug], queryFn: () => api.getDealReviews(slug || ''), staleTime: 5 * 60 * 1000 },
      { queryKey: ['related-deals', slug], queryFn: () => api.getRelatedDeals(slug || ''), staleTime: 5 * 60 * 1000 },
    ] as const,
  });
  const deal = queries[0].data?.deal;
  const reviews = queries[1].data?.reviews || [];
  const relatedDeals = queries[2].data?.deals || [];
  const isLoading = queries.some((q) => q.isLoading);

  useEffect(() => {
    if (deal) {
      applyDealMeta({
        title: deal.title,
        destination: formatDealLocation(deal.destination, deal.sub_destination),
        short_description: deal.short_description,
        description: deal.description,
        image_url: deal.image_url,
        slug: deal.slug,
      });
    }
  }, [deal]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Deal not found</p>
      </div>
    );
  }

  return (
    <div className="site-container py-12">
      <DealDetailComponent deal={deal} />
    </div>
  );
}
