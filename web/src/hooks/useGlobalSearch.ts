import { useMemo } from 'react';
import { useDeals } from './useDeals';
import { useBookings } from './useBookings';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
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
  const { deals } = useDeals();
  // The same store every bookmark button writes to, so a deal bookmarked a
  // second ago is searchable, and guests' bookmarks show up too.
  const { bookmarks } = useBookmarkStore();
  const { bookings } = useBookings();

  const { data: packagesData } = useQuery({
    queryKey: ['custom-packages'],
    queryFn: () => api.getCustomPackages(),
  });

  const packages = packagesData?.customPackages || [];

  const results = useMemo<SearchResult[]>(() => {
    if (!query || query.trim().length === 0) return [];

    const q = query.trim();
    const all: SearchResult[] = [];

    // Search deals
    deals.forEach((deal) => {
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
    bookmarks.forEach((deal) => {
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
      const searchText = [
        pkg.title || '',
        pkg.package_code || '',
        pkg.special_requests || '',
        pkg.status,
      ].join(' ');

      if (fuzzyMatch(q, searchText)) {
        all.push({
          id: pkg.id,
          type: 'package',
          title: pkg.title || 'Custom Package',
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

  return { results };
}
