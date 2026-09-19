import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReviewSummary } from './ReviewSummary';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { useDealReviews } from '@/hooks/useReviews';
import { useAuth } from '@/hooks/useAuth';

interface ReviewListProps {
  dealSlug: string;
  dealId: string;
}

export function ReviewList({ dealSlug, dealId }: ReviewListProps) {
  const { reviews, stats, isLoading } = useDealReviews(dealSlug);
  const { user, isAuthenticated } = useAuth();

  // Check if the current user already has a review
  const userReview = user ? reviews.find((r) => r.user_id === user.id) : null;
  const canReview = isAuthenticated && !userReview;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          Reviews
          {stats.review_count > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.review_count})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stats */}
        <ReviewSummary stats={stats} />

        {/* Existing reviews */}
        {isLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Loading reviews…</div>
        ) : reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} dealSlug={dealSlug} />
            ))}
          </div>
        ) : null}

        {/* Submit form */}
        {canReview && (
          <div className="border-t border-border pt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Write a review</h4>
            <ReviewForm dealSlug={dealSlug} />
          </div>
        )}

        {/* Already reviewed */}
        {userReview && (
          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              You&apos;ve already reviewed this deal. You can edit or delete your review above.
            </p>
          </div>
        )}

        {/* Not logged in */}
        {!isAuthenticated && (
          <div className="border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              <a href="/login" className="text-primary hover:underline font-medium">Sign in</a> to leave a review.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
