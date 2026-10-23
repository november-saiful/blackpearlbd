'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useComboboxContext } from './context';

export type ComboboxContentProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

export function ComboboxContent({
  children,
  className,
  align = 'start',
  sideOffset = 4,
}: ComboboxContentProps) {
  const { open, setOpen, inputRef } = useComboboxContext();
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.parentElement?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen, inputRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={cn(
        // The list floats over its own trigger's form, which is already glass;
        // 66% white over another translucent layer leaves the text behind it
        // legible. A heavier fill keeps the popover itself readable.
        'glass-strong absolute z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl bg-white/85 p-1 text-popover-foreground dark:bg-[hsl(222_24%_17%/0.88)]',
        'animate-in fade-in-0 zoom-in-95',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        className,
      )}
      style={{ marginTop: sideOffset }}
    >
      {children}
    </div>
  );
}
