import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { DealDetail as DealDetailComponent } from '@/components/deals/DealDetail';
import { useDeal } from '@/hooks/useDeals';
import { Loader2 } from 'lucide-react';
import { applyDealMeta } from '@/components/layout/PageTitle';

export default function DealDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { deal, isLoading } = useDeal(slug || '');

  useEffect(() => {
    if (deal) {
      applyDealMeta({
        title: deal.title,
        destination: deal.destination,
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
