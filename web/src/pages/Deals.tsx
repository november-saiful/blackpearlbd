import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Career3, { type JobListing } from '@/components/watermelon-ui/career-3';
import { matchesDealsFilter } from '@/components/deals/deals-filter';
import {
  applyDealsQuery,
  canonicalDealsQuery,
  decodeDealsFilterQuery,
  encodeDealsQuery,
  readDealSort,
} from '@/components/deals/deals-filter-url';
import { DealsSortMenu } from '@/components/deals/DealsSortMenu';
import { sortDeals, type DealSort } from '@/components/deals/deals-sort';
import { countFilterRules, createFilterQuery } from '@/components/reui/filters/filters-query';
import type { FilterQuery } from '@/components/reui/filters/filters-types';
import { useDeals } from '@/hooks/useDeals';
import { DealsPageSkeleton } from '@/components/skeletons/DealCardSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { formatDealLocation } from '@/components/deals/deals-destination';
import { useLocalizedDeals } from '@/lib/deal-locale';
import type { TourDeal } from '@/types';

// The filter bar is the only thing on this page that needs the reui filters
// engine, and that engine is the largest bundle the site owns. Loading it with
// the route made every visitor download it before the first card appeared,
// even though most never open a filter.
const DealsFilterBar = lazy(() =>
  import('@/components/deals/DealsFilterBar').then((module) => ({
    default: module.DealsFilterBar,
  })),
);

/** The bar collapsed to its Add filter pill, so the toolbar keeps its height. */
function FilterBarSkeleton() {
  return (
    <div
      className="flex h-[2.65rem] min-w-0 flex-1 items-center"
      role="status"
      aria-label="Loading filters"
    >
      <Skeleton className="h-full w-32 rounded-[0.8rem]" />
    </div>
  );
}

/** One deal, in the shape the grid's card list expects. */
function toJobListing(deal: TourDeal): JobListing {
  return {
    id: deal.id,
    title: deal.title,
    description: deal.short_description || deal.description || '',
    location: formatDealLocation(deal.destination, deal.sub_destination),
    type: deal.duration_days === 1 ? '1 Day' : `${deal.duration_days} Days`,
    salaryRange: formatCurrency(deal.price),
    department: formatDealLocation(deal.destination, deal.sub_destination),
    href: `/deals/${deal.slug}`,
    tags: [
      deal.is_featured ? 'Featured' : null,
      deal.original_price && deal.original_price > deal.price
        ? `${Math.round((1 - deal.price / deal.original_price) * 100)}% OFF`
        : null,
    ].filter(Boolean) as string[],
    deal,
  };
}

export default function Deals() {
  const { deals, isLoading } = useDeals();
  const localizedDeals = useLocalizedDeals(deals);
  const localizedById = useMemo(
    () => new Map(localizedDeals.map((deal) => [deal.id, deal])),
    [localizedDeals]
  );

  /*
   * The view lives in the URL, so a filtered and sorted view IS a link: it can
   * be shared, bookmarked, and it survives a reload. The bar owns the query
   * while the page is open - the block's node ids have to stay stable for its
   * drag handles and its focus - and the URL is written from both it and the
   * sort, which is why the two are compared as canonical spellings rather than
   * as objects.
   *
   * The old deep links still open the bar on the right conditions:
   * /deals?destination=Paris&category=beach&sort=price-low. An unknown
   * destination is kept as written - the chip says what was asked for, and the
   * grid says nothing matched, which beats dropping the filter and showing
   * everything - while an unknown sort falls back to Newest, since no control
   * could show which order was asked for.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState<FilterQuery>(
    () => decodeDealsFilterQuery(searchParams) ?? createFilterQuery([])
  );
  const [sortBy, setSortBy] = useState<DealSort>(() => readDealSort(searchParams));

  /*
   * Mounting the bar is what starts its download, so it waits until this screen
   * has painted what it is scored on: the filters engine is 100 KB of JavaScript
   * with a request behind it, and the byte it would share the phone connection
   * with is the picture the page is measured by. Reaching for a filter outranks
   * any picture, which is what the two handlers on the toolbar are for. The paint
   * entry is buffered, so a revisit whose picture is already in cache arms at
   * once, and a link that arrived filtered shows its chips on the first frame.
   */
  const [filtersArmed, setFiltersArmed] = useState(() => countFilterRules(query) > 0);

  useEffect(() => {
    if (filtersArmed) return;
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver(() => setFiltersArmed(true));
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      setFiltersArmed(true);
    }
    return () => observer?.disconnect();
  }, [filtersArmed]);

  /** What this page is holding, spelled as a URL would spell it. */
  const stateSearch = useMemo(
    () => canonicalDealsQuery(encodeDealsQuery(query, sortBy)),
    [query, sortBy]
  );
  /** The URL's own spelling, canonicalised, so `?experience=beach` compares
   * equal to `?category=is_any_of:beach` instead of reading as a change. */
  const urlSearch = useMemo(() => canonicalDealsQuery(searchParams), [searchParams]);
  /** What the URL last said, so our own write is not mistaken for a move. */
  const publishedSearch = useRef(urlSearch);

  useEffect(() => {
    if (urlSearch === stateSearch) {
      publishedSearch.current = stateSearch;
      return;
    }

    if (urlSearch !== publishedSearch.current) {
      // The URL moved without us: Back, or a link into this page. Adopt it.
      publishedSearch.current = urlSearch;
      setQuery(decodeDealsFilterQuery(searchParams) ?? createFilterQuery([]));
      setSortBy(readDealSort(searchParams));
      return;
    }

    // The bar or the sort moved: publish them together, off the live params so
    // one write cannot overwrite the other. `replace`, so filtering does not
    // fill the back stack with every chip the user tried.
    publishedSearch.current = stateSearch;
    setSearchParams((prev) => applyDealsQuery(prev, query, sortBy), { replace: true });
  }, [query, sortBy, stateSearch, urlSearch, searchParams, setSearchParams]);

  // One pass: the filter query, then the sort.
  const visibleJobs = useMemo(
    () =>
      sortDeals(
        deals.filter((deal) => matchesDealsFilter(deal, query)),
        sortBy
      ).map((deal) => toJobListing(localizedById.get(deal.id) ?? deal)),
    [deals, localizedById, query, sortBy]
  );

  if (isLoading) {
    return <DealsPageSkeleton />;
  }

  const emptyMessage =
    countFilterRules(query) > 0
      ? 'No tours match these filters yet. Try removing one.'
      : 'No tours found right now. Check back soon.';

  return (
    <div className="site-container pt-4 pb-2 sm:py-4">
      {/* Career3 layout with the filtered catalogue */}
      <Career3
        eyebrow="Explore our curated tour packages"
        heading="Tour Deals"
        subheading="Find your perfect getaway from our handpicked destinations"
        jobs={visibleJobs}
        toolbar={
          /* Filters left, sort right, in ONE row: the sort is a single icon
             button in the corner, level with the bar's own Add filter button
             rather than a full-width select of its own under the chips. Search
             lives in the topbar palette, so there is nothing here for it. */
          <div
            className="flex items-start gap-2 sm:gap-4"
            onPointerDownCapture={() => setFiltersArmed(true)}
            onKeyDownCapture={() => setFiltersArmed(true)}
          >
            {filtersArmed ? (
              <Suspense fallback={<FilterBarSkeleton />}>
                <DealsFilterBar
                  deals={deals}
                  query={query}
                  onQueryChange={setQuery}
                  className="min-w-0 flex-1"
                />
              </Suspense>
            ) : (
              <FilterBarSkeleton />
            )}

            <DealsSortMenu value={sortBy} onChange={setSortBy} />
          </div>
        }
        exploreLabel="Build a custom package"
        exploreHref="/build-package"
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
