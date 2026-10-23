import { Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function DealCardSkeleton() {
  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      {/* Thumbnail. The aspect lives on the frame, not on the Skeleton: the
          skeleton recipe carries a fixed height, and an explicit height wins
          over aspect-ratio, which collapsed the photo area to one thin bar.
          The glyph is the same photo slot the real card shows while its image
          is still coming. */}
      <div className="relative aspect-[16/10] w-full">
        <Skeleton className="h-full w-full rounded-none" />
        <span className="absolute inset-0 grid place-items-center">
          <ImageIcon className="h-8 w-8 text-foreground/15" />
        </span>
      </div>
      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors the real /deals layout, centred hero, the filter bar with the sort
 * control beside it, and the card grid, at the same breakpoints, so nothing
 * jumps when the deals arrive.
 */
export function DealsPageSkeleton() {
  return (
    <div className="site-container pt-4 pb-2 sm:py-4">
      <div className="flex flex-col items-center pb-10 pt-6 text-center sm:py-16 lg:py-20">
        {/* Eyebrow, heading, subheading */}
        <Skeleton className="mb-3 h-6 w-60 max-w-full rounded-full sm:mb-4" />
        <Skeleton className="h-9 w-44 max-w-full sm:h-10 sm:w-56 lg:h-12" />
        <Skeleton className="mt-3 h-5 w-72 max-w-full sm:mt-4 sm:h-7 sm:w-80" />

        {/* The collapsed filter bar is one Add filter button, not a full-width
            pill: matching its 2.65rem height, 0.8rem radius and the sort icon
            beside it means the real toolbar replaces a same-shaped placeholder
            rather than redrawing the row. */}
        <div className="mt-6 flex w-full items-start gap-2 sm:mt-10 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-start">
            <Skeleton className="h-[2.65rem] w-32 rounded-[0.8rem]" />
          </div>
          <Skeleton className="size-10 shrink-0 rounded-[0.8rem]" />
        </div>

        {/* Grid */}
        <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DealCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
