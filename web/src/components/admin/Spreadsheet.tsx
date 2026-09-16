import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, GripVertical, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Excel-style worksheet primitives for the admin destination editors.
 *
 * Every editable cell behaves like a spreadsheet cell: no chrome until you
 * focus it, `Enter` commits and drops to the next row, `Tab` commits and moves
 * right, `Escape` reverts, and the value is pushed to the API on blur.
 */

type SheetNav = {
  /** Focus the editable cell at a rendered row/column coordinate. */
  focusCell: (row: number, col: number) => void;
  /** Unique per-sheet id so datalist ids never collide between sheets. */
  sheetId: string;
};

const SheetNavContext = createContext<SheetNav | null>(null);

const CELL_BORDER = 'border-b border-r border-border last:border-r-0';
const CELL_FRAME =
  'h-9 w-full bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60';
const CELL_FOCUS = 'focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary/40';

/** Scroll container for a sheet. Enables sticky header + keyboard navigation. */
export function SheetGrid({
  children,
  className,
  maxHeight = 'max-h-[65vh]',
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  const nav = useMemo<SheetNav>(
    () => ({
      sheetId,
      focusCell: (row, col) => {
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`);
        if (!el) return;
        el.focus();
        if (el instanceof HTMLInputElement && el.type !== 'checkbox') el.select();
      },
    }),
    [sheetId],
  );

  return (
    <SheetNavContext.Provider value={nav}>
      <div
        ref={containerRef}
        className={cn(
          'overflow-auto rounded-xl border border-border bg-card shadow-sm',
          maxHeight,
          className,
        )}
      >
        {children}
      </div>
    </SheetNavContext.Provider>
  );
}

export function useSheetNav() {
  return useContext(SheetNavContext);
}

export function SheetTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm" role="grid">
      {children}
    </table>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>;
}

export function SheetHeadCell({
  children,
  className,
  stickyLeft,
}: {
  children?: ReactNode;
  className?: string;
  stickyLeft?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 whitespace-nowrap border-b border-r border-border bg-muted px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0',
        stickyLeft ? 'left-0 z-20' : 'z-10',
        className,
      )}
    >
      {children}
    </th>
  );
}

export interface SheetGutterReorder {
  /** Accessible name, e.g. `Reorder France`. */
  label: string;
  dragging?: boolean;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onMoveBy: (delta: -1 | 1) => void;
}

/**
 * Sticky row-number gutter. Pass a muted `label` to visually group child rows.
 * Pass `reorder` to turn the number into a drag handle — drag it, or focus it
 * and press ↑/↓, to move the row among its siblings.
 */
export function SheetGutterCell({
  children,
  muted,
  className,
  reorder,
}: {
  children: ReactNode;
  muted?: boolean;
  className?: string;
  reorder?: SheetGutterReorder;
}) {
  return (
    <td
      className={cn(
        'sticky left-0 z-[1] w-12 min-w-12 border-b border-r border-border bg-muted text-center align-middle text-[11px] font-medium tabular-nums transition-colors group-hover:bg-accent',
        muted && 'text-muted-foreground/50',
        !muted && 'text-muted-foreground',
        className,
      )}
    >
      {reorder ? (
        <button
          type="button"
          draggable
          aria-label={reorder.label}
          title={`${reorder.label} — drag, or press ↑/↓`}
          onDragStart={reorder.onDragStart}
          onDragEnd={reorder.onDragEnd}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            event.stopPropagation();
            reorder.onMoveBy(event.key === 'ArrowUp' ? -1 : 1);
          }}
          className={cn(
            'group/gutter relative flex h-9 w-full cursor-grab items-center justify-center rounded-sm text-inherit transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 active:cursor-grabbing',
            reorder.dragging && 'opacity-40',
          )}
        >
          <span className="transition-opacity group-hover/gutter:opacity-0">{children}</span>
          <GripVertical className="absolute h-3 w-3 opacity-0 transition-opacity group-hover/gutter:opacity-100" />
        </button>
      ) : (
        <span className="flex h-9 items-center justify-center">{children}</span>
      )}
    </td>
  );
}

/** Inset hairline that paints an insertion line on the row being dropped onto. */
export function dropIndicatorClass(position: 'before' | 'after' | null | undefined) {
  if (position === 'before') return '[&>td]:shadow-[inset_0_2px_0_0_hsl(var(--primary))]';
  if (position === 'after') return '[&>td]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]';
  return undefined;
}

export interface SheetDraft {
  /** Unique key for the draft itself, so drafts can anchor to other drafts. */
  key: string;
  /**
   * Where the draft sits: immediately before/after another row's key, or `null`
   * for the end of the sheet (also the fallback when the anchor is gone).
   */
  anchor: { key: string; side: 'before' | 'after' } | null;
}

export type PlacedSheetEntry<R, D> = { kind: 'row'; row: R } | { kind: 'draft'; draft: D };

/**
 * Interleaves client-side draft rows into the server rows at their anchors.
 * Drafts may anchor to other drafts, so "add another row below the one I just
 * added" and dragging a draft between two drafts both keep working.
 */
export function interleaveDrafts<R, D extends SheetDraft>(
  rows: R[],
  keyOfRow: (row: R) => string,
  drafts: D[],
): PlacedSheetEntry<R, D>[] {
  const before = new Map<string, D[]>();
  const after = new Map<string, D[]>();
  const loose: D[] = [];

  drafts.forEach((draft) => {
    if (!draft.anchor) {
      loose.push(draft);
      return;
    }
    const bucket = draft.anchor.side === 'before' ? before : after;
    bucket.set(draft.anchor.key, [...(bucket.get(draft.anchor.key) ?? []), draft]);
  });

  const placed = new Set<string>();
  const entries: PlacedSheetEntry<R, D>[] = [];

  const emit = (draft: D) => {
    if (placed.has(draft.key)) return;
    placed.add(draft.key);
    (before.get(draft.key) ?? []).forEach(emit);
    entries.push({ kind: 'draft', draft });
    (after.get(draft.key) ?? []).forEach(emit);
  };

  rows.forEach((row) => {
    const key = keyOfRow(row);
    (before.get(key) ?? []).forEach(emit);
    entries.push({ kind: 'row', row });
    (after.get(key) ?? []).forEach(emit);
  });

  // Drafts whose anchor was filtered out or deleted drop to the end rather than
  // disappearing from the sheet.
  loose.forEach(emit);
  drafts.forEach(emit);

  return entries;
}

/**
 * Native HTML5 drag-and-drop row reordering, constrained to siblings.
 *
 * `rows` must be the *full* ordered list of reorderable rows (not just the
 * filtered/visible slice) so a drop lands in the right place even while a
 * filter is hiding rows. `onReorder` receives the complete new order for the
 * group that changed.
 */
export interface SheetDragOptions {
  /** Whether the row being dragged may be dropped next to `targetId`. */
  canDrop: (draggedId: string, targetId: string) => boolean;
  onDrop: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  /** Keyboard `↑`/`↓` on the row handle. */
  onNudge: (id: string, delta: -1 | 1) => void;
}

/**
 * Native HTML5 row dragging shared by server rows and unsaved draft rows: the
 * caller decides what may drop where, and what that drop means.
 */
export function useSheetDrag({ canDrop, onDrop, onNudge }: SheetDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  const clear = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const startDrag = useCallback(
    (id: string) => (event: ReactDragEvent<HTMLElement>) => {
      setDraggingId(id);
      setDropTarget(null);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      // Ghost the whole row rather than just the little handle.
      const row = event.currentTarget.closest('tr');
      if (row) event.dataTransfer.setDragImage(row, 0, 0);
    },
    [],
  );

  const rowProps = useCallback(
    (id: string) => ({
      onDragOver: (event: ReactDragEvent<HTMLTableRowElement>) => {
        if (!draggingId) return;
        // Targets that refuse the drop show a "no drop" cursor instead.
        if (draggingId === id || !canDrop(draggingId, id)) {
          setDropTarget((prev) => (prev && prev.id === id ? null : prev));
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? ('before' as const) : ('after' as const);
        setDropTarget((prev) =>
          prev && prev.id === id && prev.position === position ? prev : { id, position },
        );
      },
      onDrop: (event: ReactDragEvent<HTMLTableRowElement>) => {
        event.preventDefault();
        const dragged = draggingId;
        clear();
        if (!dragged || dragged === id || !canDrop(dragged, id)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onDrop(dragged, id, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
      },
    }),
    [draggingId, canDrop, onDrop, clear],
  );

  return { draggingId, dropTarget, startDrag, endDrag: clear, moveBy: onNudge, rowProps };
}

export type SheetCommit = (next: string) => Promise<unknown> | void;

export type SheetInputCellProps = {
  row: number;
  col: number;
  value: string;
  onCommit: SheetCommit;
  /** Cascading suggestion list rendered through a native datalist. */
  options?: string[];
  type?: 'text' | 'number';
  placeholder?: string;
  align?: 'left' | 'right';
  mono?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Focus this cell as soon as it mounts (used for freshly added rows). */
  autoFocus?: boolean;
  /**
   * Replaces the default "commit and move down" behaviour of `Enter`.
   * Receives the value currently in the cell, since React state may not have
   * flushed yet when the callback runs.
   */
  onSubmit?: (value: string) => void;
  /**
   * For cells whose commit performs an action rather than editing the bound
   * value (e.g. "add a child row here"): clear the cell once it succeeds.
   */
  clearOnCommit?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
};

export function SheetInputCell({
  row,
  col,
  value,
  onCommit,
  options,
  type = 'text',
  placeholder,
  align = 'left',
  mono,
  disabled,
  invalid,
  autoFocus,
  onSubmit,
  clearOnCommit,
  title,
  ariaLabel,
  className,
}: SheetInputCellProps) {
  const nav = useContext(SheetNavContext);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const committedRef = useRef(value);

  // The server is the source of truth: resync whenever it hands us a new value.
  useEffect(() => {
    committedRef.current = value;
    setDraft(value);
  }, [value]);

  const commit = useCallback(
    async (raw: string) => {
      const next = raw.trim();
      if (next === value || next === committedRef.current) return true;
      setPending(true);
      try {
        await onCommit(next);
        committedRef.current = next;
        if (clearOnCommit) setDraft(value);
        return true;
      } catch {
        // Toast already surfaced by the mutation hook — just roll the cell back.
        setDraft(value);
        return false;
      } finally {
        setPending(false);
      }
    },
    [onCommit, value, clearOnCommit],
  );

  const handleKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (onSubmit) {
        const value = event.currentTarget.value;
        if (await commit(value)) onSubmit(value.trim());
        return;
      }
      const ok = await commit(event.currentTarget.value);
      if (ok) nav?.focusCell(row + 1, col);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(value);
      event.currentTarget.blur();
    }
  };

  const listId = options && options.length > 0 && nav ? `sheet-${nav.sheetId}-${row}-${col}` : undefined;

  return (
    <td className={cn('p-0 align-middle', CELL_BORDER, className)}>
      <div className="relative">
        <input
          data-cell={`${row}:${col}`}
          aria-label={ariaLabel}
          list={listId}
          type={type}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          title={title}
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit(draft)}
          onKeyDown={handleKeyDown}
          className={cn(
            CELL_FRAME,
            CELL_FOCUS,
            align === 'right' && 'text-right',
            mono && 'font-mono text-xs',
            invalid && 'text-destructive',
            '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        {pending && (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {listId && (
          <datalist id={listId}>
            {options!.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
      </div>
    </td>
  );
}

export type SheetSelectCellProps = {
  row: number;
  col: number;
  value: string;
  options: { value: string; label: string }[];
  onCommit: SheetCommit;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function SheetSelectCell({
  row,
  col,
  value,
  options,
  onCommit,
  placeholder = '—',
  disabled,
  ariaLabel,
  className,
}: SheetSelectCellProps) {
  const nav = useContext(SheetNavContext);
  const [pending, setPending] = useState(false);

  const commit = async (next: string) => {
    if (next === value) return;
    setPending(true);
    try {
      await onCommit(next);
    } catch {
      // Toast already surfaced by the mutation hook.
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLSelectElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      nav?.focusCell(row + 1, col);
    }
  };

  return (
    <td className={cn('p-0 align-middle', CELL_BORDER, className)}>
      <div className="relative">
        <select
          data-cell={`${row}:${col}`}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          onChange={(event) => void commit(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            CELL_FRAME,
            CELL_FOCUS,
            'cursor-pointer appearance-none pl-3 pr-7',
            !value && 'text-muted-foreground/70',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {pending ? (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
    </td>
  );
}

export type SheetToggleCellProps = {
  row: number;
  col: number;
  checked: boolean;
  onCommit: (next: boolean) => Promise<unknown> | void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function SheetToggleCell({
  row,
  col,
  checked,
  onCommit,
  disabled,
  ariaLabel,
  className,
}: SheetToggleCellProps) {
  const [pending, setPending] = useState(false);

  const handle = async (next: boolean) => {
    setPending(true);
    try {
      await onCommit(next);
    } catch {
      // Toast already surfaced by the mutation hook.
    } finally {
      setPending(false);
    }
  };

  return (
    <td className={cn('p-0 align-middle', CELL_BORDER, className)}>
      <div className="flex h-9 items-center justify-center">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <input
            data-cell={`${row}:${col}`}
            aria-label={ariaLabel}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => void handle(event.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-sm border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        )}
      </div>
    </td>
  );
}

/**
 * Row-level delete that arms on first click and asks for confirmation in place,
 * so destructive actions never need a modal.
 */
export function SheetDeleteCell({
  onDelete,
  label = 'row',
  className,
}: {
  onDelete: () => Promise<unknown> | void;
  label?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const confirm = async () => {
    setPending(true);
    try {
      await onDelete();
      setArmed(false);
    } catch {
      // Keep the cell armed so the admin can retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <td className={cn('p-0 align-middle', CELL_BORDER, className)}>
      <div className="flex h-9 items-center justify-center gap-1 px-1">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : armed ? (
          <>
            <button
              type="button"
              title={`Confirm deleting ${label}`}
              onClick={() => void confirm()}
              className="rounded border border-destructive/40 bg-destructive/10 p-1 text-destructive transition-colors hover:bg-destructive/20"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Cancel"
              onClick={() => setArmed(false)}
              className="rounded border border-border p-1 text-muted-foreground transition-colors hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            title={`Delete ${label}`}
            onClick={() => setArmed(true)}
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </td>
  );
}

export function SheetEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Keyboard cheat-sheet rendered under a sheet. */
export function SheetHints({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 text-[11px] text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Enter</Kbd> next row
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Tab</Kbd> next column
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Esc</Kbd> revert cell
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>↓</Kbd> pick from list
      </span>
      <span className="inline-flex items-center gap-1.5">
        <GripVertical className="h-3 w-3" /> drag or <Kbd>↑</Kbd>/<Kbd>↓</Kbd> the row number to reorder
      </span>
      {children}
    </div>
  );
}
