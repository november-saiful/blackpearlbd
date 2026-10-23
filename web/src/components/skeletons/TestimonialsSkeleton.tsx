import { Skeleton } from '@/components/ui/skeleton';

/**
 * Holds the testimonials block's footprint while reviews load: the section
 * heading plus the glass card's portrait and quote columns. Without this the
 * whole section appears late and pushes the footer down.
 */
export function TestimonialsSkeleton() {
  return (
    <section className="py-16" aria-busy="true" aria-label="Loading traveler reviews">
      <div className="site-container">
        <div className="mb-4 text-center">
          <Skeleton className="mx-auto mb-4 h-9 w-64 max-w-full" />
          <Skeleton className="mx-auto h-4 w-72 max-w-full" />
        </div>

        <div className="glass mx-auto max-w-sm rounded-3xl px-4 py-12 md:max-w-4xl md:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-y-12 md:grid-cols-2 md:gap-x-20">
            <div className="flex items-center justify-center">
              <Skeleton className="h-80 w-full max-w-xs rounded-3xl" />
            </div>
            <div className="flex flex-col justify-center space-y-3 py-4">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
