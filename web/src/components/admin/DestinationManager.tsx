import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Compass, Loader2, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePackageDestinations } from '@/hooks/useAdmin';
import type { PackageDestination } from '@/types';
import {
  SheetBody,
  SheetDeleteCell,
  SheetGutterCell,
  SheetGrid,
  SheetHeadCell,
  SheetHints,
  SheetInputCell,
  SheetTable,
  SheetToggleCell,
  SheetEmptyRow,
  dropIndicatorClass,
  interleaveDrafts,
  useSheetDrag,
} from './Spreadsheet';

type DestinationOrderCache = { destinations: PackageDestination[] };

type DestinationPatch = {
  category?: string;
  name?: string;
  value?: string;
  sort_order?: number;
  is_active?: boolean;
};

type DraftAnchor = { key: string; side: 'before' | 'after' };

type DraftRow = {
  key: string;
  /** Where the unsaved row sits in the sheet; `null` = end. */
  anchor: DraftAnchor | null;
  category: string;
  name: string;
  value: string;
  active: boolean;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export function DestinationManager() {
  const queryClient = useQueryClient();
  const { destinations, isLoading, createDestination, updateDestination, deleteDestination } =
    usePackageDestinations();

  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const draftSeq = useRef(0);

  const patch = (id: string, data: DestinationPatch) =>
    new Promise<void>((resolve, reject) => {
      updateDestination({ id, data }, { onSuccess: () => resolve(), onError: reject });
    });

  const remove = (id: string) =>
    new Promise<void>((resolve, reject) => {
      deleteDestination(id, { onSuccess: () => resolve(), onError: reject });
    });

  const create = (data: Required<Pick<DestinationPatch, 'category' | 'name' | 'value'>> & DestinationPatch) =>
    new Promise<PackageDestination>((resolve, reject) => {
      createDestination(data, { onSuccess: (result) => resolve(result.destination), onError: reject });
    });

  const categories = useMemo(
    () => Array.from(new Set(destinations.map((d) => d.category))).sort((a, b) => a.localeCompare(b)),
    [destinations],
  );

  const activeCount = destinations.filter((d) => d.is_active).length;

  // Render from sort_order rather than the server's array order, so a reorder
  // (and an inline sort_order edit) is reflected the moment it is committed.
  const orderedDestinations = useMemo(
    () =>
      [...destinations].sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name),
      ),
    [destinations],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orderedDestinations.filter((d) => {
      if (!showInactive && !d.is_active) return false;
      if (!needle) return true;
      return (
        d.category.toLowerCase().includes(needle) ||
        d.name.toLowerCase().includes(needle) ||
        d.value.toLowerCase().includes(needle)
      );
    });
  }, [orderedDestinations, query, showInactive]);

  /** The freshest rows: the query cache wins, so optimistic writes are visible. */
  const cacheDestinations = () =>
    queryClient.getQueryData<DestinationOrderCache>(['admin-package-destinations'])?.destinations ?? destinations;

  /** Ids of one category in display order. */
  const categoryIdsInOrder = (category: string, rows: PackageDestination[]) =>
    rows
      .filter((destination) => destination.category === category)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((destination) => destination.id);

  /** Renumbers a category 1..n, persisting only the rows that actually moved. */
  const applyOrder = (category: string, orderedIds: string[]) => {
    const current = cacheDestinations();
    const sortById = new Map(orderedIds.map((id, index) => [id, index + 1]));
    const changed = orderedIds
      .map((id) => ({
        id,
        to: sortById.get(id) as number,
        from: current.find((destination) => destination.id === id)?.sort_order,
      }))
      .filter((item): item is { id: string; to: number; from: number } => item.from !== undefined && item.to !== item.from);

    // Paint the new order straight into the cache so the sheet doesn't snap
    // back to the server order while the PATCHes are in flight.
    queryClient.setQueryData<DestinationOrderCache>(['admin-package-destinations'], (prev) =>
      prev
        ? {
            ...prev,
            destinations: prev.destinations.map((destination) =>
              sortById.has(destination.id)
                ? { ...destination, sort_order: sortById.get(destination.id) as number }
                : destination,
            ),
          }
        : prev,
    );

    if (changed.length === 0) return;

    void Promise.allSettled(changed.map((item) => patch(item.id, { sort_order: item.to }))).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-package-destinations'] }),
    );
  };

  // Draft rows are pure client state; they are only saved once the admin confirms.
  // Each one remembers where the cursor was, so it renders right below that row.
  const draftKeys = useMemo(() => new Set(drafts.map((draft) => draft.key)), [drafts]);
  const knownRowKeys = useMemo(
    () => new Set([...visible.map((destination) => destination.id), ...draftKeys]),
    [visible, draftKeys],
  );
  const anchorKey = activeRowKey && knownRowKeys.has(activeRowKey) ? activeRowKey : null;

  const nextDraftKey = () => `draft-${++draftSeq.current}`;

  const addDraft = () =>
    setDrafts((prev) => [
      ...prev,
      {
        key: nextDraftKey(),
        anchor: anchorKey ? { key: anchorKey, side: 'after' } : null,
        category: '',
        name: '',
        value: '',
        active: true,
      },
    ]);
  const updateDraft = (key: string, patchRow: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patchRow } : d)));
  const dropDraft = (key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setActiveRowKey((prev) => (prev === key ? null : prev));
  };

  const draftReady = (draft: DraftRow) =>
    draft.category.trim().length > 0 && draft.name.trim().length > 0 && slugify(draft.value.trim() || draft.name).length > 0;

  /** Walks an anchor chain down to a saved row, so drafts anchored to drafts resolve too. */
  const resolveAnchor = (anchor: DraftAnchor | null): DraftAnchor | null => {
    const seen = new Set<string>();
    let current = anchor;
    while (current) {
      if (seen.has(current.key)) return null;
      seen.add(current.key);
      const next = drafts.find((draft) => draft.key === current?.key);
      if (!next) return current;
      current = next.anchor;
    }
    return null;
  };

  const commitDraft = async (draft: DraftRow, options: { chain?: boolean } = {}) => {
    if (!draftReady(draft)) return;
    const category = draft.category.trim();
    const anchor = resolveAnchor(draft.anchor);

    // Provisional position so the INSERT lands near its neighbours; applyOrder
    // then normalises the whole category.
    const siblings = cacheDestinations()
      .filter((destination) => destination.category === category)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const anchorRow = anchor ? siblings.find((destination) => destination.id === anchor.key) : undefined;
    const last = siblings[siblings.length - 1];
    const provisionalSort =
      anchor && anchorRow
        ? anchor.side === 'before'
          ? anchorRow.sort_order
          : anchorRow.sort_order + 1
        : (last?.sort_order ?? 0) + 1;

    try {
      const created = await create({
        category,
        name: draft.name.trim(),
        value: slugify(draft.value.trim() || draft.name),
        sort_order: provisionalSort,
        is_active: draft.active,
      });

      // Fold the saved row into the cache so the ordering maths (and the sheet)
      // can see it before the refetch lands.
      queryClient.setQueryData<DestinationOrderCache>(['admin-package-destinations'], (prev) =>
        prev ? { ...prev, destinations: [...prev.destinations, created] } : prev,
      );

      const without = categoryIdsInOrder(category, cacheDestinations()).filter((id) => id !== created.id);
      const anchorIndex = anchor ? without.indexOf(anchor.key) : -1;
      // Fall back to the end when the anchor vanished (deleted, or filtered out).
      const insertAt =
        !anchor || anchorIndex < 0 ? without.length : anchor.side === 'before' ? anchorIndex : anchorIndex + 1;
      without.splice(insertAt, 0, created.id);
      applyOrder(category, without);

      // Anything parked under the row we just saved now follows the saved row.
      setDrafts((prev) =>
        prev
          .filter((other) => other.key !== draft.key)
          .map((other) =>
            other.anchor && other.anchor.key === draft.key
              ? { ...other, anchor: { key: created.id, side: 'after' } }
              : other,
          ),
      );
      if (anchorKey === draft.key) setActiveRowKey(created.id);

      // Enter keeps the streak going: hand back a fresh row underneath.
      if (options.chain) {
        setDrafts((prev) => [
          ...prev,
          {
            key: nextDraftKey(),
            anchor: { key: created.id, side: 'after' },
            category,
            name: '',
            value: '',
            active: draft.active,
          },
        ]);
      }
    } catch {
      // Toast already surfaced by the mutation hook.
    }
  };

  const categoryOfRow = useMemo(
    () => new Map(orderedDestinations.map((destination) => [destination.id, destination.category])),
    [orderedDestinations],
  );

  const reorder = useSheetDrag({
    // Saved rows reorder among their category; drafts may be parked anywhere.
    canDrop: (draggedId, targetId) => {
      if (draftKeys.has(draggedId)) return true;
      if (draftKeys.has(targetId)) return false;
      const category = categoryOfRow.get(draggedId);
      return category !== undefined && category === categoryOfRow.get(targetId);
    },
    onDrop: (draggedId, targetId, position) => {
      if (draftKeys.has(draggedId)) {
        updateDraft(draggedId, { anchor: { key: targetId, side: position } });
        return;
      }
      const category = categoryOfRow.get(draggedId);
      if (!category) return;
      const ids = categoryIdsInOrder(category, orderedDestinations).filter((id) => id !== draggedId);
      const at = ids.indexOf(targetId);
      if (at < 0) return;
      ids.splice(position === 'before' ? at : at + 1, 0, draggedId);
      applyOrder(category, ids);
    },
    onNudge: (id, delta) => {
      const side = delta === -1 ? ('before' as const) : ('after' as const);
      if (draftKeys.has(id)) {
        const index = renderedRows.findIndex((entry) => entry.kind === 'draft' && entry.draft.key === id);
        const neighbour = renderedRows[index + delta];
        if (index < 0 || !neighbour) return;
        updateDraft(id, {
          anchor: { key: neighbour.kind === 'row' ? neighbour.row.id : neighbour.draft.key, side },
        });
        return;
      }
      const category = categoryOfRow.get(id);
      if (!category) return;
      const ids = categoryIdsInOrder(category, orderedDestinations);
      const index = ids.indexOf(id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= ids.length) return;
      ids.splice(index, 1);
      ids.splice(next, 0, id);
      applyOrder(category, ids);
    },
  });

  const renderedRows = useMemo(
    () => interleaveDrafts(visible, (destination) => destination.id, drafts),
    [visible, drafts],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Compass className="h-5 w-5 text-muted-foreground" />
            Package Builder Destinations
            <Badge variant="secondary" className="ml-1 text-xs font-medium">
              {activeCount}/{destinations.length} active
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter destinations…"
                className="h-9 w-56 pl-8 text-sm"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded-sm border-border accent-primary"
              />
              Show inactive
            </label>
            <Button
              size="sm"
              onClick={addDraft}
              className="gap-1.5"
              title={anchorKey ? 'Insert a row below the row you were editing' : 'Insert a row at the end'}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading destinations…
          </div>
        ) : (
          <>
            <SheetGrid>
              <SheetTable>
                <thead>
                  <tr>
                    <SheetHeadCell stickyLeft className="w-12 px-1" />
                    <SheetHeadCell className="w-[18%]">Category</SheetHeadCell>
                    <SheetHeadCell className="w-[26%]">Display name</SheetHeadCell>
                    <SheetHeadCell className="w-[26%]">Value (slug)</SheetHeadCell>
                    <SheetHeadCell className="w-20 text-right">Sort</SheetHeadCell>
                    <SheetHeadCell className="w-16 text-center">Active</SheetHeadCell>
                    <SheetHeadCell className="w-20 text-center">Row</SheetHeadCell>
                  </tr>
                </thead>
                <SheetBody>
                  {renderedRows.map((entry, index) => {
                    if (entry.kind === 'row') {
                    const destination = entry.row;
                    return (
                    <tr
                      key={destination.id}
                      onFocus={() => setActiveRowKey(destination.id)}
                      className={cn(
                        'group',
                        reorder.draggingId === destination.id && 'opacity-50',
                        dropIndicatorClass(
                          reorder.dropTarget?.id === destination.id ? reorder.dropTarget.position : null,
                        ),
                      )}
                      {...reorder.rowProps(destination.id)}
                    >
                      <SheetGutterCell
                        muted={!destination.is_active}
                        reorder={{
                          label: `Reorder ${destination.name}`,
                          dragging: reorder.draggingId === destination.id,
                          onDragStart: reorder.startDrag(destination.id),
                          onDragEnd: reorder.endDrag,
                          onMoveBy: (delta) => reorder.moveBy(destination.id, delta),
                        }}
                      >
                        {index + 1}
                      </SheetGutterCell>
                      <SheetInputCell
                        row={index}
                        col={1}
                        value={destination.category}
                        options={categories}
                        ariaLabel={`Category for ${destination.name}`}
                        onCommit={(next) =>
                          next ? patch(destination.id, { category: next }) : Promise.reject(new Error('Category is required'))
                        }
                        className={cn(!destination.is_active && 'opacity-60')}
                      />
                      <SheetInputCell
                        row={index}
                        col={2}
                        value={destination.name}
                        ariaLabel={`Display name for ${destination.name}`}
                        onCommit={(next) =>
                          next ? patch(destination.id, { name: next }) : Promise.reject(new Error('Name is required'))
                        }
                        className={cn(!destination.is_active && 'opacity-60')}
                      />
                      <SheetInputCell
                        row={index}
                        col={3}
                        value={destination.value}
                        mono
                        invalid={!destination.value}
                        ariaLabel={`Slug for ${destination.name}`}
                        title="Lowercase letters, numbers and hyphens only"
                        onCommit={(next) =>
                          next
                            ? patch(destination.id, { value: slugify(next) })
                            : Promise.reject(new Error('Slug is required'))
                        }
                        className={cn(!destination.is_active && 'opacity-60')}
                      />
                      <SheetInputCell
                        row={index}
                        col={4}
                        type="number"
                        align="right"
                        value={String(destination.sort_order)}
                        ariaLabel={`Sort order for ${destination.name}`}
                        onCommit={(next) => patch(destination.id, { sort_order: Number(next) || 0 })}
                        className={cn(!destination.is_active && 'opacity-60')}
                      />
                      <SheetToggleCell
                        row={index}
                        col={5}
                        checked={destination.is_active}
                        ariaLabel={`Toggle ${destination.name}`}
                        onCommit={(next) => patch(destination.id, { is_active: next })}
                      />
                      <SheetDeleteCell
                        label={destination.name}
                        onDelete={() => remove(destination.id)}
                        className="w-20"
                      />
                    </tr>
                    );
                    }

                    const draft = entry.draft;
                    const row = index;
                    return (
                      <tr
                        key={draft.key}
                        onFocus={() => setActiveRowKey(draft.key)}
                        className={cn(
                          'group bg-primary/[0.03]',
                          reorder.draggingId === draft.key && 'opacity-50',
                          dropIndicatorClass(reorder.dropTarget?.id === draft.key ? reorder.dropTarget.position : null),
                        )}
                        {...reorder.rowProps(draft.key)}
                      >
                        <SheetGutterCell
                          reorder={{
                            label: `Move unsaved row${draft.name ? ` ${draft.name}` : ''}`,
                            dragging: reorder.draggingId === draft.key,
                            onDragStart: reorder.startDrag(draft.key),
                            onDragEnd: reorder.endDrag,
                            onMoveBy: (delta) => reorder.moveBy(draft.key, delta),
                          }}
                        >
                          <Plus className="h-3 w-3 text-primary" />
                        </SheetGutterCell>
                        <SheetInputCell
                          row={row}
                          col={1}
                          value={draft.category}
                          options={categories}
                          placeholder="Category"
                          autoFocus
                          ariaLabel="New destination category"
                          onCommit={(next) => updateDraft(draft.key, { category: next })}
                        />
                        <SheetInputCell
                          row={row}
                          col={2}
                          value={draft.name}
                          placeholder="Display name"
                          ariaLabel="New destination name"
                          onCommit={(next) =>
                            updateDraft(draft.key, {
                              name: next,
                              value: draft.value || slugify(next),
                            })
                          }
                        />
                        <SheetInputCell
                          row={row}
                          col={3}
                          value={draft.value}
                          mono
                          placeholder="auto-slug"
                          ariaLabel="New destination slug"
                          onCommit={(next) => updateDraft(draft.key, { value: next })}
                          onSubmit={(value) => void commitDraft({ ...draft, value: draft.value || value }, { chain: true })}
                        />
                        <td
                          className="border-b border-r border-border p-0 align-middle"
                          title="Position comes from where this row sits — it is numbered on save"
                        >
                          <span className="block px-3 text-xs text-muted-foreground">auto</span>
                        </td>
                        <SheetToggleCell
                          row={row}
                          col={5}
                          checked={draft.active}
                          ariaLabel="New destination active"
                          onCommit={(next) => updateDraft(draft.key, { active: next })}
                        />
                        <td className="w-20 border-b border-border p-0 align-middle">
                          <div className="flex h-9 items-center justify-center gap-1 px-1">
                            <button
                              type="button"
                              title="Save this row"
                              disabled={!draftReady(draft)}
                              onClick={() => void commitDraft(draft)}
                              className="rounded border border-emerald-500/40 bg-emerald-500/10 p-1 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Discard this row"
                              onClick={() => dropDraft(draft.key)}
                              className="rounded border border-border p-1 text-muted-foreground transition-colors hover:bg-accent"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {renderedRows.length === 0 && (
                    <SheetEmptyRow colSpan={7}>
                      {destinations.length === 0
                        ? 'No destinations yet — use “Add row” to create the first one.'
                        : 'No destinations match this filter.'}
                    </SheetEmptyRow>
                  )}
                </SheetBody>
              </SheetTable>
            </SheetGrid>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SheetHints>
                <span className="inline-flex items-center gap-1.5">rows reorder within their category</span>
                <span className="inline-flex items-center gap-1.5">
                  unsaved rows can be dragged too — they are numbered where you drop them
                </span>
              </SheetHints>
              <p className="pt-3 text-[11px] text-muted-foreground">
                {visible.length} of {destinations.length} destinations
                {drafts.length > 0 && ` · ${drafts.length} unsaved`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
