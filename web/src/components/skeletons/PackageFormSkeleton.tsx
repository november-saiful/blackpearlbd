import { Skeleton } from '@/components/ui/skeleton';

/**
 * Holds the embedded package builder's footprint while its chunk loads: the
 * step progress, the heading block, and the destination and date fields.
 */
export function PackageFormSkeleton() {
  return (
    <div className="w-full space-y-6" aria-busy="true" aria-label="Loading package builder">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="w-full">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
