'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

const GroupContext = createContext<string | undefined>(undefined);
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComboboxContext } from './context';

export type ComboboxListProps = {
  children: ReactNode;
  className?: string;
};

export function ComboboxList({ children, className }: ComboboxListProps) {
  return (
    <div
      role="listbox"
      className={cn('max-h-60 overflow-auto p-1', className)}
    >
      {children}
    </div>
  );
}

export type ComboboxItemProps = {
  value: string;
  children: ReactNode;
  /** Display text used for registration and search matching. Falls back to value. */
  textValue?: string;
  /** Extra keywords for search matching (e.g. detail text, group names). */
  keywords?: string[];
  className?: string;
  disabled?: boolean;
};

export function ComboboxItem({
  value,
  children,
  textValue,
  keywords,
  className,
  disabled,
}: ComboboxItemProps) {
  const { value: selected, onValueChange, filter, search, registerItem, unregisterItem } = useComboboxContext();
  const group = useContext(GroupContext);
  const isSelected = selected === value;
  const label = textValue ?? value;

  // Register this item with the context so ComboboxValue can look it up
  useEffect(() => {
    registerItem(value, label, group);
    return () => unregisterItem(value);
  }, [value, label, group, registerItem, unregisterItem]);

  // Build a searchable string from textValue + keywords
  const searchText = [textValue, ...(keywords ?? [])].join(' ');

  // Filter visibility based on search
  if (search && searchText && filter(searchText, search) === 0) {
    return null;
  } else if (search && !searchText && filter(value, search) === 0) {
    return null;
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-white/50 focus:bg-white/50 focus:outline-none dark:hover:bg-white/10 dark:focus:bg-white/10',
        isSelected && 'bg-white/60 dark:bg-white/15',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <span className="flex-1 truncate">{children}</span>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

export type ComboboxGroupProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function ComboboxGroup({ label, children, className }: ComboboxGroupProps) {
  return (
    <GroupContext.Provider value={label}>
      <div role="group" className={cn('mb-1', className)}>
        {label && (
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {label}
          </div>
        )}
        {children}
      </div>
    </GroupContext.Provider>
  );
}

export type ComboboxLabelProps = {
  children: ReactNode;
  className?: string;
};

export function ComboboxLabel({ children, className }: ComboboxLabelProps) {
  return (
    <div className={cn('px-2 py-1 text-xs font-medium text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export type ComboboxEmptyProps = {
  children?: ReactNode;
  className?: string;
};

export function ComboboxEmpty({ children = 'No results found.', className }: ComboboxEmptyProps) {
  const { search } = useComboboxContext();
  if (!search) return null;

  return (
    <div className={cn('px-2 py-4 text-center text-sm text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export function ComboboxSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 h-px bg-border', className)} />;
}
