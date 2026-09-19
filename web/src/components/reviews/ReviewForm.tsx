import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateReview, useUpdateReview } from '@/hooks/useReviews';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  dealSlug: string;
  initialValues?: { rating: number; title: string; body: string };
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ReviewForm({
  dealSlug,
  initialValues,
  submitLabel = 'Submit review',
  onCancel,
  onSuccess,
}: ReviewFormProps) {
  const [rating, setRating] = useState(initialValues?.rating || 0);
  const [title, setTitle] = useState(initialValues?.title || '');
  const [body, setBody] = useState(initialValues?.body || '');
  const [errors, setErrors] = useState<{ rating?: string; title?: string; body?: string }>({});

  const isEditing = !!initialValues;
  const createReview = useCreateReview(dealSlug);
  const updateReview = useUpdateReview(dealSlug);
  const isPending = createReview.isPending || updateReview.isPending;

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (rating < 1 || rating > 5) next.rating = 'Please select a rating';
    if (title.trim().length < 3) next.title = 'Title must be at least 3 characters';
    if (body.trim().length < 10) next.body = 'Review must be at least 10 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data = { rating, title: title.trim(), body: body.trim() };

    if (isEditing && initialValues) {
      updateReview.mutate(
        { id: (initialValues as any).id || '', data },
        { onSuccess: () => onSuccess?.() },
      );
    } else {
      createReview.mutate(data, {
        onSuccess: () => {
          setRating(0);
          setTitle('');
          setBody('');
          onSuccess?.();
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Rating</label>
        <StarRating value={rating} onChange={setRating} size="lg" />
        {errors.rating && <p className="text-xs text-destructive mt-1">{errors.rating}</p>}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-foreground mb-1.5">
          Title
        </label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={200}
          className={cn(errors.title && 'border-destructive')}
        />
        {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
      </div>

      {/* Body */}
      <div>
        <label htmlFor="review-body" className="block text-sm font-medium text-foreground mb-1.5">
          Your review
        </label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell others about your experience on this tour..."
          rows={4}
          maxLength={5000}
          className={cn(errors.body && 'border-destructive')}
        />
        {errors.body && <p className="text-xs text-destructive mt-1">{errors.body}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
