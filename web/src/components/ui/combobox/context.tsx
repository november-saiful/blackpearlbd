'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export type ComboboxFilter = (value: string, search: string) => number;

type ComboboxContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  setSearch: (search: string) => void;
  filter: ComboboxFilter;
  items: Map<string, { label: string; group?: string }>;
  registerItem: (value: string, label: string, group?: string) => void;
  unregisterItem: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

const ComboboxContext = createContext<ComboboxContextValue | null>(null);

export function useComboboxContext() {
  const ctx = useContext(ComboboxContext);
  if (!ctx) throw new Error('Combobox components must be used within <Combobox>');
  return ctx;
}

const defaultFilter: ComboboxFilter = (value, search) => {
  const lower = value.toLowerCase();
  const s = search.toLowerCase();
  if (lower.startsWith(s)) return 1;
  if (lower.includes(s)) return 0.5;
  return 0;
};

export type ComboboxProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  filter?: ComboboxFilter;
  children: ReactNode;
  className?: string;
};

export function Combobox({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  filter = defaultFilter,
  children,
  className,
}: ComboboxProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const itemsRef = useRef(new Map<string, { label: string; group?: string }>());
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      onValueChange?.(v);
      setOpen(false);
      setSearch('');
    },
    [isControlled, onValueChange],
  );

  const registerItem = useCallback((value: string, label: string, group?: string) => {
    itemsRef.current.set(value, { label, group });
  }, []);

  const unregisterItem = useCallback((value: string) => {
    itemsRef.current.delete(value);
  }, []);

  const ctx = useMemo<ComboboxContextValue>(
    () => ({
      open,
      setOpen,
      value: currentValue,
      onValueChange: handleValueChange,
      search,
      setSearch,
      filter,
      items: itemsRef.current,
      registerItem,
      unregisterItem,
      inputRef,
      triggerRef,
    }),
    [open, currentValue, handleValueChange, search, filter, registerItem, unregisterItem],
  );

  return (
    <ComboboxContext.Provider value={ctx}>
      <div className={cn('relative', className)}>{children}</div>
    </ComboboxContext.Provider>
  );
}
