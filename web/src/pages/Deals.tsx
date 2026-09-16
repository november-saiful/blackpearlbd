import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Career3, { type CategoryFilter, type JobListing } from '@/components/watermelon-ui/career-3';
import { useDeals, useSavedDeals } from '@/hooks/useDeals';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DealsPageSkeleton } from '@/components/skeletons/DealCardSkeleton';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { DEAL_CATEGORIES, getDealCategory } from '@/lib/deal-category';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function Deals() {
  const { deals, isLoading } = useDeals();
  const { savedDeals } = useSavedDeals();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Deep link support: /deals?destination=Paris pre-selects that destination tab
  const [searchParams] = useSearchParams();
  const requestedDestination = searchParams.get('destination')?.trim() || '';

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Deep link support: /deals?category=beach pre-selects that experience chip
  const requestedCategory = searchParams.get('category')?.trim().toLowerCase() || '';
  const [activeCategory, setActiveCategory] = useState(
    DEAL_CATEGORIES.some((c) => c.key === requestedCategory) ? requestedCategory : 'all'
  );

  // Derive unique destinations as department tabs
  const departments = useMemo(() => {
    const dests = [...new Set(deals.map((d) => d.destination))];
    return dests.length > 0 ? ['All', ...dests] : ['All'];
  }, [deals]);

  const hasDestinationTab = requestedDestination !== '' && departments.includes(requestedDestination);

  // If the requested destination has no dedicated tab (no deals there yet),
  // fall back to pre-filling the search box with it.
  useEffect(() => {
    if (!isLoading && requestedDestination && !hasDestinationTab) {
      setSearch(requestedDestination);
    }
  }, [isLoading, requestedDestination, hasDestinationTab]);

  // Map TourDeal → JobListing for Career3
  const allJobs: JobListing[] = useMemo(() => {
    return deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      description: deal.short_description || deal.description || '',
      location: deal.destination,
      type: deal.duration_days === 1 ? '1 Day' : `${deal.duration_days} Days`,
      salaryRange: formatCurrency(deal.price),
      department: deal.destination,
      href: `/deals/${deal.slug}`,
      tags: [
        deal.is_featured ? 'Featured' : null,
        deal.original_price && deal.original_price > deal.price
          ? `${Math.round((1 - deal.price / deal.original_price) * 100)}% OFF`
          : null,
      ].filter(Boolean) as string[],
      deal: deal, // Pass the full deal object for bookmarking
    }));
  }, [deals]);

  // Apply search filter
  const searchedJobs = useMemo(() => {
    let result = allJobs;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          (j.deal?.deal_code && j.deal.deal_code.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allJobs, search]);

  // The destination tab the grid is currently showing. Career3 owns the tab
  // state (it also supports ?destination= deep links) and reports it back here
  // so the experience chips can be scoped to the same slice of the catalogue.
  const [activeDestination, setActiveDestination] = useState('All');

  // Experience category chips. The set of chips is derived from the deals the
  // current destination tab can actually show (so a chip never promises results
  // the tab hides), while the counts also track the search box. The active chip
  // is always kept visible so it can be switched off even at zero results.
  const categories: CategoryFilter[] = useMemo(() => {
    const inScope =
      activeDestination === 'All'
        ? searchedJobs
        : searchedJobs.filter((j) => j.department === activeDestination);

    const counts = new Map<string, number>();
    inScope.forEach((j) => {
      const key = getDealCategory(j.deal).key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return DEAL_CATEGORIES.filter(
      (c) => counts.has(c.key) || c.key === activeCategory
    ).map((c) => ({
      key: c.key,
      label: c.label,
      emoji: c.emoji,
      className: c.className,
      count: counts.get(c.key) ?? 0,
    }));
  }, [searchedJobs, activeDestination, activeCategory]);

  // Apply the experience filter, then sort
  const filteredJobs = useMemo(() => {
    let result =
      activeCategory === 'all'
        ? searchedJobs
        : searchedJobs.filter((j) => getDealCategory(j.deal).key === activeCategory);

    // Sort
    switch (sortBy) {
      case 'price-low':
        result = [...result].sort((a, b) => {
          const pa = parseFloat(a.salaryRange.replace(/[^0-9.]/g, ''));
          const pb = parseFloat(b.salaryRange.replace(/[^0-9.]/g, ''));
          return pa - pb;
        });
        break;
      case 'price-high':
        result = [...result].sort((a, b) => {
          const pa = parseFloat(a.salaryRange.replace(/[^0-9.]/g, ''));
          const pb = parseFloat(b.salaryRange.replace(/[^0-9.]/g, ''));
          return pb - pa;
        });
        break;
      case 'featured':
        result = [...result].sort(
          (a, b) => (b.tags?.includes('Featured') ? 1 : 0) - (a.tags?.includes('Featured') ? 1 : 0)
        );
        break;
      case 'newest':
      default:
        // keep original order (API returns newest first)
        break;
    }

    return result;
  }, [searchedJobs, activeCategory, sortBy]);

  const activeCategoryMeta = categories.find((c) => c.key === activeCategory);

  // Hide the chips only when there is genuinely nothing to choose between. A
  // filter that is still on always keeps the row visible, otherwise narrowing
  // the destination tab could strand you with an invisible active filter.
  const showCategories = categories.length > 1 || activeCategory !== 'all';

  if (isLoading) {
    return <DealsPageSkeleton />;
  }

  return (
    <div className="site-container py-4">
      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by destination, title, or deal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Career3 layout with filtered data */}
      <Career3
        eyebrow="Explore our curated tour packages"
        heading="Tour Deals"
        subheading="Find your perfect getaway from our handpicked destinations"
        departments={departments}
        defaultDepartment={hasDestinationTab ? requestedDestination : undefined}
        jobs={filteredJobs}
        categories={showCategories ? categories : undefined}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onDepartmentChange={setActiveDestination}
        exploreLabel="Build a custom package"
        exploreHref="/build-package"
        emptyMessage={
          activeCategoryMeta
            ? `No ${activeCategoryMeta.label} tours match your filters yet. Try another experience or destination.`
            : 'No tours found matching your search. Try a different keyword.'
        }
      />
    </div>
  );
}
