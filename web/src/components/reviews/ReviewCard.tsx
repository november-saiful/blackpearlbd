import { useState } from 'react';
import { User, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { StarRating } from './StarRating';
import { ReviewForm } from './ReviewForm';
import { useUpdateReview, useDeleteReview } from '@/hooks/useReviews';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Review } from '@/types';

interface ReviewCardProps {
  review: Review;
  dealSlug: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ReviewCard({ review, dealSlug }: ReviewCardProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const updateReview = useUpdateReview(dealSlug);
  const deleteReview = useDeleteReview(dealSlug);
  const isOwn = user?.id === review.user_id;

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <ReviewForm
          dealSlug={dealSlug}
          initialValues={{ rating: review.rating, title: review.title, body: review.body }}
          submitLabel="Update review"
          onCancel={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header: user + rating + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {review.user?.avatar_url ? (
              <img
                src={review.user.avatar_url}
                alt={review.user.full_name || ''}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {review.user?.full_name || 'Anonymous'}
              </span>
              {review.booking_id && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={review.rating} readonly size="sm" />
              <span className="text-[11px] text-muted-foreground">{timeAgo(review.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Edit / Delete for own reviews */}
        {isOwn && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit review"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete your review?')) {
                  deleteReview.mutate(review.id);
                }
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete review"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground">{review.title}</h4>

      {/* Body */}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.body}</p>
    </div>
  );
}
