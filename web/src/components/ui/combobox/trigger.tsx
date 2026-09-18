'use client';

import { useCallback, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComboboxContext } from './context';

// The native button's props ride through, so a caller can give the trigger an
// `id`, an `aria-label` or a `disabled` state like any other control. `onClick`
// is the one exception: opening the list is the trigger's whole job.
export type ComboboxTriggerProps = Omit<ComponentPropsWithoutRef<'button'>, 'onClick'> & {
  children?: ReactNode;
  /** Accepted for API symmetry with the other primitives; not implemented. */
  asChild?: boolean;
};

export function ComboboxTrigger({
  children,
  className,
  asChild: _asChild,
  ...props
}: ComboboxTriggerProps) {
  const { open, setOpen, inputRef } = useComboboxContext();

  const handleClick = useCallback(() => {
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, setOpen, inputRef]);

  return (
    <button
      type="button"
      onClick={handleClick}
      // The list is a `role="listbox"` inside the panel, so the trigger owns the
      // combobox semantics and announces whether that panel is showing.
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cn(
        'flex h-10 w-full items-center justify-between overflow-hidden rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-foreground/20',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}

export type ComboboxValueProps = {
  placeholder?: string;
  className?: string;
};

export function ComboboxValue({ placeholder = 'Select...', className }: ComboboxValueProps) {
  const { value, items } = useComboboxContext();
  const item = items.get(value);

  if (!item) {
    return (
      <span className={cn('truncate text-muted-foreground', className)}>
        {placeholder}
      </span>
    );
  }

  return (
    <span className={cn('truncate', className)}>
      {item.group ? (
        <>
          <span className="text-muted-foreground text-xs">{item.group} › </span>
          <span className="font-medium text-foreground">{item.label}</span>
        </>
      ) : (
        item.label
      )}
    </span>
  );
}

export type ComboboxInputProps = {
  placeholder?: string;
  className?: string;
};

export function ComboboxInput({ placeholder = 'Search...', className }: ComboboxInputProps) {
  const { search, setSearch, inputRef, setOpen, open } = useComboboxContext();

  return (
    <input
      ref={inputRef}
      type="text"
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        if (!open) setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      placeholder={placeholder}
      className={cn(
        'h-10 w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
        className,
      )}
    />
  );
}
