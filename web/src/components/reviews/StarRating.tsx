import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function StarRating({ value, onChange, readonly = false, size = 'md', className }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      onMouseLeave={() => !readonly && setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          className={cn(
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            readonly ? 'cursor-default' : 'cursor-pointer',
          )}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              sizeMap[size],
              'transition-colors',
              star <= displayValue
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  );
}
