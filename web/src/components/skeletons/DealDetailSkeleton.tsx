import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Mirrors `components/deals/DealDetail.tsx`: the coverflow rack, the header
 * block (location, code, title, facts, price and actions) and the two-column
 * itinerary/about area. Sized so the real deal lands without the page moving.
 */
export function DealDetailSkeleton() {
  return (
    <div className="site-container py-12">
      {/* Coverflow rack: one square card, centred, with the frame's vertical padding. */}
      <div className="mb-8 py-10">
        <Skeleton className="mx-auto size-[clamp(148px,22vw,260px)] rounded-2xl" />
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-3 h-4 w-36" />
          <Skeleton className="mb-3 h-3.5 w-24" />
          <Skeleton className="mb-3 h-9 w-full max-w-lg" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <div className="md:shrink-0 md:text-right">
          <Skeleton className="mb-4 h-9 w-36 md:ml-auto" />
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>
      </div>

      {/* Itinerary plus the about/inclusions/exclusions column */}
      <div className="grid items-stretch gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-8">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex h-full flex-col gap-6">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
