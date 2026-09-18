import { Skeleton } from '@/components/ui/skeleton';

export function DealCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Thumbnail */}
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
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
 * Mirrors the real /deals layout — centred hero, the filter bar with the sort
 * control beside it, and the card grid — at the same breakpoints, so nothing
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

        {/* Filter bar left, sort icon button right, in one row - the sort took
            the filter bar's own control height so the two line up. */}
        <div className="mt-6 flex w-full items-start gap-2 sm:mt-10 sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <Skeleton className="size-10 shrink-0 rounded-md" />
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
