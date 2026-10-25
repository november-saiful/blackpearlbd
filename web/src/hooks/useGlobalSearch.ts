import { useMemo } from 'react';
import { useDeals } from './useDeals';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { api } from '@/lib/api';
import { humanizeDashes } from '@/lib/text';
import { localizePlaceName, useLocalizedDeals } from '@/lib/deal-locale';
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

/**
 * Both language versions are searchable regardless of which one the visitor is
 * reading, so a Bengali title still matches a query typed in the English view
 * and an English title matches Bengali keywords.
 */
function searchableDealText(deal: TourDeal): string {
  return [
    deal.title,
    deal.title_en,
    deal.title_bn,
    deal.short_description,
    deal.short_description_en,
    deal.short_description_bn,
    deal.description,
    deal.description_en,
    deal.description_bn,
    deal.deal_code,
    localizePlaceName(deal.destination, 'en'),
    localizePlaceName(deal.destination, 'bn'),
    deal.sub_destination,
    deal.sub_destination ? localizePlaceName(deal.sub_destination, 'en') : '',
    deal.sub_destination ? localizePlaceName(deal.sub_destination, 'bn') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function useGlobalSearch(query: string) {
  const { deals, isLoading: dealsLoading } = useDeals();
  // The same store every bookmark button writes to, so a deal bookmarked a
  // second ago is searchable, and guests' bookmarks show up too.
  const { bookmarks } = useBookmarkStore();
  const user = useAuthStore((state) => state.user);
  const localizedDeals = useLocalizedDeals(deals);
  const localizedBookmarks = useLocalizedDeals(bookmarks);

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
    deals.forEach((rawDeal, index) => {
      const deal = localizedDeals[index] ?? rawDeal;

      if (fuzzyMatch(q, searchableDealText(rawDeal))) {
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
    bookmarks.forEach((rawDeal, index) => {
      const deal = localizedBookmarks[index] ?? rawDeal;

      if (fuzzyMatch(q, searchableDealText(rawDeal))) {
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
  }, [query, deals, bookmarks, packages, localizedDeals, localizedBookmarks]);

  return { results, isLoading: dealsLoading || packagesLoading };
}
