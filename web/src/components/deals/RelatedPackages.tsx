import { Link, useNavigate } from 'react-router-dom';
import { MapPin, CalendarDays } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDealCategory } from '@/lib/deal-category';
import { useLocalizedDeals } from '@/lib/deal-locale';
import { formatCurrency } from '@/lib/utils';
import { formatDurationShort } from '@/lib/duration';
import type { TourDeal } from '@/types';

interface RelatedPackagesProps {
  deals: TourDeal[];
  isLoading?: boolean;
}

/**
 * Skeleton that mirrors the layout of a single related-package row.
 */
function RelatedPackageSkeletonRow() {
  return (
    <li>
      <div className="glass-field flex items-center gap-3 rounded-lg p-2.5">
        <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </li>
  );
}

/**
 * Compact card that lists related packages below the main tour info.
 * Shown in the right column of the deal detail page to visually balance
 * the taller itinerary column.
 */
export function RelatedPackages({ deals, isLoading }: RelatedPackagesProps) {
  const localizedDeals = useLocalizedDeals(deals);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <RelatedPackageSkeletonRow key={i} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Packages</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {localizedDeals.map((deal) => {
            const category = getDealCategory(deal);
            const image = deal.image_url || deal.gallery?.[0] || null;

            return (
              <li key={deal.id}>
                <div
                  onClickCapture={(event) => {
                    // Same rule as the deal card: the row is not an anchor, so
                    // forward the click, but never treat a drag that selected
                    // text as one.
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString()) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    if ((event.target as HTMLElement).closest('a, button')) return;
                    navigate(`/deals/${deal.slug}`);
                  }}
                  className="glass-field glass-hover group flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors"
                >
                  {/* Thumbnail. Only the photo is a link, so the row's copy
                      stays outside an anchor and can be selected. */}
                  <Link
                    to={`/deals/${deal.slug}`}
                    aria-label={deal.title}
                    className="glass-soft relative h-14 w-14 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
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
                  </Link>

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
                        {formatDurationShort(deal.duration_days)}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm font-bold text-primary">
                      {formatCurrency(deal.price)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
