import { Skeleton } from '@/components/ui/skeleton';

/**
 * Mirrors the grouped result list on `/search`: the count line, the group
 * heading and the image/title/subtitle/price rows.
 */
export function SearchResultsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />

      <div>
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="glass flex items-center gap-3 rounded-xl p-3 sm:gap-4 sm:p-4"
            >
              <Skeleton className="size-12 shrink-0 rounded-lg sm:size-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-1/2 max-w-64" />
                  <Skeleton className="h-4 w-16 shrink-0 rounded-full" />
                </div>
                <Skeleton className="h-3 w-2/3 max-w-80" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
