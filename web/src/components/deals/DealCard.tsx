import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Route as RouteIcon, Sparkles } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getDealCategory } from '@/lib/deal-category';
import { formatDealLocation } from './deals-destination';
import type { TourDeal } from '@/types';

interface DealCardProps {
  deal: TourDeal;
  /**
   * Floating control rendered over the thumbnail (bookmark/save button).
   * Clicks inside it never trigger the card's navigation.
   */
  action?: ReactNode;
  className?: string;
}

/**
 * The tour deal card. Fully presentational and self-contained: it reads
 * everything from the deal so the grid, featured sections and search results
 * can all render the same card.
 */
export function DealCard({ deal, action, className }: DealCardProps) {
  const image = deal.image_url || deal.gallery?.[0] || '';
  const category = getDealCategory(deal);
  const location = formatDealLocation(deal.destination, deal.sub_destination);
  const originalPrice =
    deal.original_price && deal.original_price > deal.price ? deal.original_price : null;
  const discount = originalPrice ? Math.round((1 - deal.price / originalPrice) * 100) : 0;
  const stops = (deal.route_waypoints || []).length;
  const blurb = (deal.short_description || deal.description || '').trim();

  return (
    <Link
      to={`/deals/${deal.slug}`}
      aria-label={`${deal.title} — ${category.label} in ${location}`}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-300',
        'hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={deal.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-secondary/20">
            <MapPin className="h-9 w-9 text-primary/40" />
          </div>
        )}

        {/* Keeps the chips readable over any photo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        {deal.is_featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-sm">
            <Sparkles className="h-3 w-3" />
            Featured
          </span>
        )}

        {action && (
          <div
            className="absolute right-3 top-3 z-10"
            onClick={(event) => {
              // Keep bookmark/save clicks from following the card link.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {action}
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </span>
          {discount > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              {discount}% OFF
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
              category.className,
            )}
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {deal.duration_days} {deal.duration_days === 1 ? 'Day' : 'Days'}
          </span>
          {stops > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <RouteIcon className="h-3 w-3" />
              {stops} {stops === 1 ? 'stop' : 'stops'}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-lg">
          {deal.title}
        </h3>

        {blurb && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{blurb}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xl font-bold text-primary">{formatCurrency(deal.price)}</span>
              {originalPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">per person</span>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary/90">
            View details
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
