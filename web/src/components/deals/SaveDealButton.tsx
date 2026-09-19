import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import type { TourDeal } from '@/types';

interface SaveDealButtonProps {
  /**
   * The full deal, not just its id: the bookmark store keeps the deal itself so
   * the topbar dropdown can render it without another fetch.
   */
  deal: TourDeal;
  className?: string;
}

/**
 * Bookmark toggle for a deal card. Shares the bookmark store with the deal
 * page, the tours grid and the topbar dropdown, so every button in the app
 * reflects the same saved state — and guests can bookmark too.
 */
export function SaveDealButton({ deal, className }: SaveDealButtonProps) {
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const isSaved = isBookmarked(deal.id);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
      onClick={() => toggleBookmark(deal)}
      className={className}
    >
      <Heart className={cn('w-5 h-5', isSaved && 'fill-rose-500 text-rose-500')} />
    </Button>
  );
}
