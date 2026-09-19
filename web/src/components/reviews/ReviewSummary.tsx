import { Star } from 'lucide-react';
import { StarRating } from './StarRating';
import type { ReviewStats } from '@/types';

interface ReviewSummaryProps {
  stats: ReviewStats;
}

export function ReviewSummary({ stats }: ReviewSummaryProps) {
  const { avg_rating, review_count, distribution } = stats;
  const maxCount = Math.max(...distribution, 1);

  if (review_count === 0) {
    return (
      <div className="text-center py-6">
        <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review this deal!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      {/* Left: big average */}
      <div className="text-center sm:text-left shrink-0">
        <div className="text-4xl font-bold text-foreground">{avg_rating.toFixed(1)}</div>
        <StarRating value={Math.round(avg_rating)} readonly size="md" className="mt-1 justify-center sm:justify-start" />
        <p className="text-xs text-muted-foreground mt-1">
          {review_count} {review_count === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      {/* Right: distribution bars */}
      <div className="flex-1 w-full space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1] || 0;
          const pct = review_count > 0 ? (count / review_count) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
