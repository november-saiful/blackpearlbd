import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  Route as RouteIcon,
  Sparkles,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getDealCategory } from '@/lib/deal-category';
import { humanizeDealText } from '@/lib/text';
import {
  claimLeadPhotoSlot,
  onLeadPhotoSettled,
  settleLeadPhotoSlot,
} from '@/lib/lead-photo-slot';
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
export function DealCard({ deal: rawDeal, action, className }: DealCardProps) {
  const deal = humanizeDealText(rawDeal);
  const image = deal.image_url || deal.gallery?.[0] || '';
  const category = getDealCategory(deal);
  const location = formatDealLocation(deal.destination, deal.sub_destination);
  const originalPrice =
    deal.original_price && deal.original_price > deal.price ? deal.original_price : null;
  const discount = originalPrice ? Math.round((1 - deal.price / originalPrice) * 100) : 0;
  const stops = (deal.route_waypoints || []).length;
  const blurb = (deal.short_description || deal.description || '').trim();

  const frameRef = useRef<HTMLDivElement>(null);
  // A deal photo is roughly 200 KB and there is no smaller rendition to serve,
  // so a grid of them has to wait its turn. Native loading="lazy" starts about
  // 1250 px early, which on a phone means six thumbnails downloading while the
  // hero photo is still in flight and pushes the first screen out by seconds.
  // This mounts the img only when the card is genuinely close to the viewport.
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !image || nearViewport) return;
    if (!('IntersectionObserver' in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px 240px' },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [image, nearViewport]);

  // Being near the screen is not the same as being allowed to download: the
  // first card to ask takes the connection, and this one mounts once that photo
  // has settled. See `lead-photo-slot`.
  const leadPhoto = useRef(false);
  const [mayDownload, setMayDownload] = useState(false);

  useEffect(() => {
    if (!image || !nearViewport || mayDownload) return;
    if (claimLeadPhotoSlot()) {
      leadPhoto.current = true;
      setMayDownload(true);
      return;
    }
    return onLeadPhotoSettled(() => setMayDownload(true));
  }, [image, nearViewport, mayDownload]);

  // The frame shows a designed placeholder until the bytes are in, so a card
  // that is waiting for its turn on the connection reads as a photo still
  // coming, not as a component that failed to render.
  const [photoReady, setPhotoReady] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  // A photo already in the cache never fires a load event for a freshly mounted
  // img, so the lead has to notice that itself or the grid waits out the clock.
  const settle = () => {
    if (leadPhoto.current) settleLeadPhotoSlot();
  };
  const checkLead = (node: HTMLImageElement | null) => {
    if (!node?.complete) return;
    if (node.naturalWidth > 0) setPhotoReady(true);
    settle();
  };

  // Lowercase, and spread, because react-dom 18.2 drops the camelCase prop and
  // the attribute is what moves the request up the browser's queue. The lead
  // photo is the largest thing on this screen and the Bengali faces the titles
  // need are 200 KB of high priority text bytes downloading beside it.
  const leadPriority = leadPhoto.current ? { fetchpriority: 'high' } : undefined;

  return (
    <Link
      to={`/deals/${deal.slug}`}
      aria-label={`${deal.title}: ${category.label} in ${location}`}
      className={cn(
        'glass glass-hover paint-contained group relative flex h-full flex-col overflow-hidden rounded-2xl text-card-foreground',
        'hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {/* Thumbnail */}
      <div ref={frameRef} className="glass-soft relative aspect-[16/10] w-full overflow-hidden">
        {!image ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-secondary/20">
            <MapPin className="h-9 w-9 text-primary/40" />
          </div>
        ) : (
          <>
            {/* A photo slot, not a blank box: the soft gradient and the photo
                glyph hold the frame while the image waits for the connection,
                and fade out under the photo once it lands. */}
            <div
              aria-hidden="true"
              className={cn(
                'deal-photo-slot absolute inset-0 flex items-center justify-center transition-opacity duration-300',
                photoReady ? 'opacity-0' : 'opacity-100',
                !photoReady && !photoFailed && 'animate-pulse',
              )}
            >
              {photoFailed ? (
                <MapPin className="h-9 w-9 text-primary/40" />
              ) : (
                <ImageIcon className="h-8 w-8 text-foreground/15" />
              )}
            </div>

            {mayDownload && (
              <img
                ref={checkLead}
                {...leadPriority}
                src={image}
                alt={deal.title}
                loading="lazy"
                decoding="async"
                onLoad={() => {
                  setPhotoReady(true);
                  settle();
                }}
                onError={() => {
                  setPhotoFailed(true);
                  settle();
                }}
                className={cn(
                  'relative h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.06]',
                  photoReady ? 'opacity-100' : 'opacity-0',
                )}
              />
            )}
          </>
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
          <span className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
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
          <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {deal.duration_days} {deal.duration_days === 1 ? 'Day' : 'Days'}
          </span>
          {stops > 0 && (
            <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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

          <span className="glass-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors">
            View details
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
