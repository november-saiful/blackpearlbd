import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { Card, CardContent } from '@/components/ui/card';
import { DealCard } from '@/components/deals/DealCard';
import { api } from '@/lib/api';
import { DealGrid } from '@/components/deals/DealGrid';
import { DealCardSkeleton } from '@/components/skeletons/DealCardSkeleton';
import { PackageFormSkeleton } from '@/components/skeletons/PackageFormSkeleton';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { CTabs6 } from '@/components/examples/c-tabs-6';
import { AnimatedReviews } from '@/components/reviews/AnimatedReviews';
import { Compass, Star, ArrowRight } from '@/components/ui/icons';
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon';
import type { TourDeal } from '@/types';
import { useQueries } from '@tanstack/react-query';

// The builder is a large form behind an inactive tab; Radix unmounts inactive
// tab content, so this download starts only when the tab is actually opened.
const BuildPackageForm = lazy(() => import('@/components/package-builder/BuildPackageForm'));

function TourDealsPreview({ deals, isLoading }: { deals: TourDeal[]; isLoading: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Tour Deals</h3>
        <Link to="/deals" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <DealCardSkeleton key={index} />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No deals available right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.slice(0, 6).map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // Parallelise the independent public reads so the homepage never waits on one
  // API call before starting the next: the deals list and the homepage
  // testimonial strip both hit Supabase through the Worker's edge cache, and
  // running them in the same tick removes the serial waterline.
  const [dealsQuery] = useQueries({
    queries: [
      { queryKey: ['deals'], queryFn: () => api.getDeals(), staleTime: 5 * 60 * 1000 },
      { queryKey: ['featured-reviews'], queryFn: () => api.getFeaturedReviews(), staleTime: 2 * 60 * 1000 },
    ] as const,
  });
  const allDeals = dealsQuery.data?.deals || [];
  const featuredDeals = allDeals.filter((d) => d.is_featured).slice(0, 6);

  return (
    <div>
      {/* Hero: full-viewport deal carousel; the topbar floats over it. */}
      <HeroCarousel
        deals={allDeals}
        hasError={dealsQuery.isError}
        isLoading={dealsQuery.isLoading}
      />

      {/* Quick access tabs: below the first screen */}
      <section className="site-container py-8 sm:py-10">
        <div className="text-left w-full">
          <CTabs6
            defaultValue="tours"
            ariaLabel="Quick access"
            items={[
              {
                id: 'tours',
                label: 'Tour Deals',
                icon: <Compass />,
                content: <TourDealsPreview deals={allDeals} isLoading={dealsQuery.isLoading} />,
              },
              {
                id: 'packages',
                label: 'Build Package',
                icon: <BuildPackageIcon />,
                content: (
                  <Suspense fallback={<PackageFormSkeleton />}>
                    <BuildPackageForm embedded />
                  </Suspense>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Featured Deals */}
      {(dealsQuery.isLoading || featuredDeals.length > 0) && (
        <section className="site-container py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Featured Tour Deals</h2>
            <p className="text-muted-foreground">Handpicked destinations for unforgettable experiences</p>
          </div>
          {dealsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <DealCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <DealGrid deals={featuredDeals} />
          )}
          <div className="text-center mt-8">
            <Link to="/deals">
              <Button variant="outline" size="lg">
                View All Deals
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="site-container py-16">
        <div className="glass rounded-3xl px-4 py-12 sm:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">How It Works</h2>
            <p className="text-muted-foreground">Three simple steps to your dream vacation</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="glass-chip w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Compass className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Choose Your Destination</h3>
                <p className="text-muted-foreground">Browse our curated tour deals or build your own custom package</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="glass-chip w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BuildPackageIcon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Customize Your Trip</h3>
                <p className="text-muted-foreground">Select dates, accommodation, activities, and set your budget</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="glass-chip w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Book & Earn Pearls</h3>
                <p className="text-muted-foreground">Confirm your booking, get your invoice, and earn loyalty pearls</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials / Reviews */}
      <AnimatedReviews />

    </div>
  );
}
