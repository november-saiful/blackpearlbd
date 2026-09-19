import { Link } from 'react-router-dom';
import { MapPin, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDealCategory } from '@/lib/deal-category';
import { formatCurrency } from '@/lib/utils';
import type { TourDeal } from '@/types';

interface RelatedPackagesProps {
  deals: TourDeal[];
}

/**
 * Compact card that lists related packages below the main tour info.
 * Shown in the right column of the deal detail page to visually balance
 * the taller itinerary column.
 */
export function RelatedPackages({ deals }: RelatedPackagesProps) {
  if (deals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Packages</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {deals.map((deal) => {
            const category = getDealCategory(deal);
            const image = deal.image_url || deal.gallery?.[0] || null;

            return (
              <li key={deal.id}>
                <Link
                  to={`/deals/${deal.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 transition-colors hover:border-primary/30 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt={deal.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                        <MapPin className="h-4 w-4 text-primary/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {deal.title}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span aria-hidden="true">{category.emoji}</span>
                        {category.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {deal.duration_days}D
                      </span>
                    </div>
                    <span className="mt-1 block text-sm font-bold text-primary">
                      {formatCurrency(deal.price)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
