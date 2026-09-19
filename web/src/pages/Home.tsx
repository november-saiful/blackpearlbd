import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DealCard } from '@/components/deals/DealCard';
import { DealGrid } from '@/components/deals/DealGrid';
import { useDeals } from '@/hooks/useDeals';
import { GlobePolaroids } from '@/components/ui/component';
import { StarsBackground } from '@/components/ui/stars-background';
import { CTabs6 } from '@/components/examples/c-tabs-6';
import BuildPackageForm from '@/components/package-builder/BuildPackageForm';
import { Compass, Star, ArrowRight } from 'lucide-react';
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon';
import type { TourDeal } from '@/types';

function TourDealsPreview({ deals }: { deals: TourDeal[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Tour Deals</h3>
        <Link to="/deals" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {deals.length === 0 ? (
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

function BuildPackagePreview() {
  return <BuildPackageForm embedded />;
}

export default function Home() {
  const { deals, isLoading } = useDeals();
  const navigate = useNavigate();
  const allDeals = deals;
  const featuredDeals = deals.filter((d) => d.is_featured).slice(0, 6);

  const globeMotionRef = React.useRef<{ phi: number; theta: number }>({ phi: 0, theta: 0 });

  const handleGlobeMotion = React.useCallback((offset: { phi: number; theta: number } | null) => {
    if (offset) {
      globeMotionRef.current = offset;
    }
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <StarsBackground
        className="text-hero-foreground overflow-hidden"
        globeOffset={globeMotionRef.current}
      >
        {/* Edge-to-edge first screen: full viewport — topbar and mobile dock float above it */}
        <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pt-20 pb-24 sm:px-6 md:pt-24 md:pb-12">
          <div className="w-full max-w-5xl mx-auto text-center">
            {/* Globe — scales with visible screen height, big on every breakpoint.
                Width = min(<dvh>, 100%) so it can never exceed its container:
                a dvh-only width overflows on tall/narrow phones, and an
                overflowing block with mx-auto gets margin:0 → shifts left. */}
            <div className="mx-auto mb-3 w-[min(50dvh,100%)] min-w-[240px] max-w-[440px] sm:mb-5 md:mb-6 md:w-[min(58dvh,100%)] md:max-w-[720px] lg:w-[min(62dvh,100%)] lg:max-w-[840px]">
              <GlobePolaroids
                onMotionChange={handleGlobeMotion}
                onSelect={(m) => navigate(`/deals?destination=${encodeURIComponent(m.caption)}`)}
              />
            </div>

            <div className="z-10 space-y-4">
              <h1 className="text-[clamp(1.875rem,9.8vw,3.75rem)] leading-[1.1] tracking-tight md:text-6xl md:leading-none md:tracking-normal font-bold">
                Discover Your Next
                <span className="text-hero-foreground"> Adventure</span>
              </h1>
              <p className="mx-auto max-w-md text-base sm:max-w-lg sm:text-xl md:max-w-2xl text-hero-foreground/70">
                BlackPearl brings you curated tour deals and custom packages 
                to the world's most amazing destinations.
              </p>
            </div>
          </div>
        </div>
      </StarsBackground>

      {/* Quick access tabs — below the first screen */}
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
                content: <TourDealsPreview deals={allDeals} />,
              },
              {
                id: 'packages',
                label: 'Build Package',
                icon: <BuildPackageIcon />,
                content: <BuildPackagePreview />,
              },
            ]}
          />
        </div>
      </section>

      {/* Featured Deals */}
      {featuredDeals.length > 0 && (
        <section className="site-container py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Featured Tour Deals</h2>
            <p className="text-muted-foreground">Handpicked destinations for unforgettable experiences</p>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading deals...</div>
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
      <section className="py-16 bg-muted">
        <div className="site-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">How It Works</h2>
            <p className="text-muted-foreground">Three simple steps to your dream vacation</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Compass className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Choose Your Destination</h3>
                <p className="text-muted-foreground">
                  Browse our curated tour deals or build your own custom package
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BuildPackageIcon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Customize Your Trip</h3>
                <p className="text-muted-foreground">
                  Select dates, accommodation, activities, and set your budget
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">Book & Earn Pearls</h3>
                <p className="text-muted-foreground">
                  Confirm your booking, get your invoice, and earn loyalty pearls
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

    </div>
  );
}
