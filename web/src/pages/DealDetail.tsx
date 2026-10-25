import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DealDetail as DealDetailComponent } from '@/components/deals/DealDetail';
import { DealDetailSkeleton } from '@/components/skeletons/DealDetailSkeleton';
import { applyDealMeta, applyDealNotFoundMeta } from '@/components/layout/PageTitle';
import { formatDealLocation } from '@/components/deals/deals-destination';
import { useContentLocale } from '@/lib/locale';
import { localizeDeal } from '@/lib/deal-locale';
import type { TourDeal } from '@/types';

export default function DealDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const { locale } = useContentLocale();

  // Only the deal record gates this page. Reviews render inside the component
  // through their own query, and the sibling strip derives from the deals list
  // the grid already fetched; both used to be requested here and awaited here,
  // so the skeleton sat on two responses nothing on this screen read.
  //
  // The cached list also seeds this query: arriving from Home or the grid paints
  // the real page at once, because the card the visitor tapped is the same row
  // the list endpoint already returned. A deep link has no list yet and falls
  // back to the fetch.
  const dealQuery = useQuery({
    queryKey: ['deal', slug],
    queryFn: () => api.getDeal(slug || ''),
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      const list = queryClient.getQueryData<{ deals: TourDeal[] }>(['deals']);
      const match = list?.deals.find((d) => d.slug === slug);
      return match ? { deal: match } : undefined;
    },
  });
  const deal = dealQuery.data?.deal;
  const isLoading = dealQuery.isPending;

  useEffect(() => {
    if (deal) {
      const localized = localizeDeal(deal, locale);
      applyDealMeta({
        title: localized.title,
        destination: formatDealLocation(localized.destination, localized.sub_destination),
        short_description: localized.short_description,
        description: localized.description,
        image_url: localized.image_url,
        slug: localized.slug,
      });
    }
  }, [deal, locale]);

  // Mirrors what the edge renderer writes for the same URL, so the title does
  // not fall back to the generic pending one once the app takes over.
  useEffect(() => {
    if (!isLoading && !deal) applyDealNotFoundMeta();
  }, [isLoading, deal]);

  if (isLoading) {
    return <DealDetailSkeleton />;
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
