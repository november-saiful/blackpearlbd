import { useMemo } from 'react';
import { useDeals } from './useDeals';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { api } from '@/lib/api';
import { humanizeDealText, humanizeDashes } from '@/lib/text';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import type { TourDeal, CustomPackage } from '@/types';

export type SearchResultType = 'deal' | 'package' | 'bookmark';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  dealCode?: string | null;
  price?: number;
  imageUrl?: string | null;
  href: string;
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (const ch of t) {
    if (ch === q[qi]) qi++;
    if (qi === q.length) return true;
  }
  return false;
}

export function useGlobalSearch(query: string) {
  const { deals, isLoading: dealsLoading } = useDeals();
  // The same store every bookmark button writes to, so a deal bookmarked a
  // second ago is searchable, and guests' bookmarks show up too.
  const { bookmarks } = useBookmarkStore();
  const user = useAuthStore((state) => state.user);

  // Custom packages are private to the signed-in traveller. Guest searches
  // should not issue the request at all.
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['custom-packages'],
    queryFn: () => api.getCustomPackages(),
    enabled: Boolean(user),
  });

  const packages = packagesData?.customPackages || [];

  const results = useMemo<SearchResult[]>(() => {
    if (!query || query.trim().length === 0) return [];

    const q = query.trim();
    const all: SearchResult[] = [];

    // Search deals
    deals.forEach((rawDeal) => {
      const deal = humanizeDealText(rawDeal);
      const searchText = [
        deal.title,
        deal.destination,
        deal.deal_code || '',
        deal.description || '',
      ].join(' ');

      if (fuzzyMatch(q, searchText)) {
        all.push({
          id: deal.id,
          type: 'deal',
          title: deal.title,
          subtitle: deal.destination + (deal.deal_code ? ` · ${deal.deal_code}` : ''),
          dealCode: deal.deal_code,
          price: deal.price,
          imageUrl: deal.image_url,
          href: `/deals/${deal.slug}`,
        });
      }
    });

    // Search bookmarks
    bookmarks.forEach((rawDeal) => {
      const deal = humanizeDealText(rawDeal);
      const searchText = [
        deal.title,
        deal.destination,
        deal.deal_code || '',
      ].join(' ');

      if (fuzzyMatch(q, searchText)) {
        // Avoid duplicates if already in deals results
        if (!all.some((r) => r.id === deal.id)) {
          all.push({
            id: `bookmark-${deal.id}`,
            type: 'bookmark',
            title: deal.title,
            subtitle: `Bookmarked · ${deal.destination}` + (deal.deal_code ? ` · ${deal.deal_code}` : ''),
            dealCode: deal.deal_code,
            price: deal.price,
            imageUrl: deal.image_url,
            href: `/deals/${deal.slug}`,
          });
        }
      }
    });

    // Search custom packages
    packages.forEach((pkg) => {
      const title = humanizeDashes(pkg.title || '');
      const searchText = [
        title,
        pkg.package_code || '',
        pkg.special_requests || '',
        pkg.status,
      ].join(' ');

      if (fuzzyMatch(q, searchText)) {
        all.push({
          id: pkg.id,
          type: 'package',
          title: title || 'Custom Package',
          subtitle: pkg.package_code || `Status: ${pkg.status}`,
          dealCode: pkg.package_code,
          price: pkg.budget || pkg.estimated_price || undefined,
          imageUrl: null,
          href: '/profile',
        });
      }
    });

    return all;
  }, [query, deals, bookmarks, packages]);

  return { results, isLoading: dealsLoading || packagesLoading };
}
