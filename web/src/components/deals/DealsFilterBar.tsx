import { useMemo } from 'react';
import { Filters } from '@/components/reui/filters/filters';
import type { FilterQuery } from '@/components/reui/filters/filters-types';
import { usePackageDestinations } from '@/hooks/useAdmin';
import type { TourDeal } from '@/types';
import { dealFilterFields } from './deals-filter';

interface DealsFilterBarProps {
  /**
   * The whole catalogue, not the page of results: the destination and category
   * options are built from it, so they never offer a filter that cannot match
   * anything.
   */
  deals: TourDeal[];
  /** Controlled query. The page owns it, so the grid and the bar agree. */
  query: FilterQuery;
  onQueryChange: (query: FilterQuery) => void;
  className?: string;
}

/**
 * The deals filter bar: the reui `Filters` block over the deals field schema.
 *
 * Kept as a component rather than spread into the page so the schema, its
 * options and the matcher in `deals-filter` stay one unit - the page only ever
 * holds the query.
 */
export function DealsFilterBar({
  deals,
  query,
  onQueryChange,
  className,
}: DealsFilterBarProps) {
  const { destinations } = usePackageDestinations();
  const fields = useMemo(() => dealFilterFields(deals, destinations), [deals, destinations]);

  return (
    <Filters
      fields={fields}
      query={query}
      onQueryChange={onQueryChange}
      showClear
      labels={{ filtersLabel: 'Tour filters' }}
      className={className}
    />
  );
}
