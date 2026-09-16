import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { usePackageDestinations, usePackageDistricts, usePackageTourSpots } from '@/hooks/useAdmin';
import type { PackageDistrict, PackageTourSpot } from '@/types';
import {
  SheetBody,
  SheetDeleteCell,
  SheetEmptyRow,
  SheetGutterCell,
  SheetGrid,
  SheetHeadCell,
  SheetHints,
  SheetInputCell,
  SheetSelectCell,
  SheetTable,
  SheetToggleCell,
  dropIndicatorClass,
  interleaveDrafts,
  useSheetDrag,
} from './Spreadsheet';

type DistrictOrderCache = { districts: PackageDistrict[] };
type SpotOrderCache = { tourSpots: PackageTourSpot[] };

/**
 * Flat "Bangladesh regions" worksheet with cascading cells:
 * division → district → tour spot. Every district owns a row of its own (its
 * tour-spot cell empty) and its tour spots follow underneath, so district
 * level settings stay editable even when a district has spots.
 */

type RegionRow = {
  key: string;
  kind: 'district' | 'spot';
  districtId: string;
  districtName: string;
  divisionValue: string;
  spotId: string | null;
  spotName: string;
  sortOrder: number;
  isActive: boolean;
  districtOrdinal: number;
};

type DraftAnchor = { key: string; side: 'before' | 'after' };

type DraftRow = {
  key: string;
  /** Where the unsaved row sits in the sheet; `null` = end. */
  anchor: DraftAnchor | null;
  divisionValue: string;
  districtName: string;
  spotName: string;
  active: boolean;
};

const bySortThenName = <T extends { sort_order: number; name: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name);

export function BangladeshDataManager() {
  const queryClient = useQueryClient();
  const { destinations, isLoading: destinationsLoading } = usePackageDestinations();
  const districtsApi = usePackageDistricts();
  const spotsApi = usePackageTourSpots();

  const [query, setQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const draftSeq = useRef(0);

  // Local-only cascade state: when a spot row's division is changed we narrow the
  // district list before committing, so nothing is written until a district is picked.
  const [spotDivision, setSpotDivision] = useState<Record<string, string>>({});

  const isLoading = destinationsLoading || districtsApi.isLoading || spotsApi.isLoading;

  /* ── Derived cascade data ─────────────────────────────────────────── */

  const divisions = useMemo(
    () => destinations.filter((d) => d.category === 'Bangladesh' && d.value !== 'bangladesh-customized'),
    [destinations],
  );

  const districtsByDivision = useMemo(() => {
    const map = new Map<string, PackageDistrict[]>();
    districtsApi.districts.forEach((district) => {
      const list = map.get(district.division_value) ?? [];
      list.push(district);
      map.set(district.division_value, list);
    });
    map.forEach((list) => list.sort(bySortThenName));
    return map;
  }, [districtsApi.districts]);

  const spotsByDistrict = useMemo(() => {
    const map = new Map<string, PackageTourSpot[]>();
    spotsApi.tourSpots.forEach((spot) => {
      const list = map.get(spot.district_id) ?? [];
      list.push(spot);
      map.set(spot.district_id, list);
    });
    map.forEach((list) => list.sort(bySortThenName));
    return map;
  }, [spotsApi.tourSpots]);

  const rows = useMemo<RegionRow[]>(() => {
    const out: RegionRow[] = [];
    let districtOrdinal = 0;
    divisions.forEach((division) => {
      (districtsByDivision.get(division.value) ?? []).forEach((district) => {
        districtOrdinal += 1;
        const base = {
          districtId: district.id,
          districtName: district.name,
          divisionValue: district.division_value,
          districtOrdinal,
        };
        out.push({
          ...base,
          key: `d:${district.id}`,
          kind: 'district',
          spotId: null,
          spotName: '',
          sortOrder: district.sort_order,
          isActive: district.is_active,
        });
        (spotsByDistrict.get(district.id) ?? []).forEach((spot) => {
          out.push({
            ...base,
            key: `s:${spot.id}`,
            kind: 'spot',
            spotId: spot.id,
            spotName: spot.name,
            sortOrder: spot.sort_order,
            isActive: spot.is_active,
          });
        });
      });
    });
    return out;
  }, [divisions, districtsByDivision, spotsByDistrict]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (divisionFilter && row.divisionValue !== divisionFilter) return false;
      if (!showInactive && !row.isActive) return false;
      if (!needle) return true;
      return (
        row.divisionValue.toLowerCase().includes(needle) ||
        row.districtName.toLowerCase().includes(needle) ||
        row.spotName.toLowerCase().includes(needle)
      );
    });
  }, [rows, query, divisionFilter, showInactive]);

  /** Server rows with the client-side draft rows slotted in below their anchor. */
  const renderedRows = useMemo(
    () => interleaveDrafts(visibleRows, (row) => row.key, drafts),
    [visibleRows, drafts],
  );

  const draftKeys = useMemo(() => new Set(drafts.map((draft) => draft.key)), [drafts]);
  const updateDraft = (key: string, patch: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const divisionOptions = useMemo(
    () => divisions.map((division) => ({ value: division.value, label: division.name })),
    [divisions],
  );

  const districtCount = districtsApi.districts.length;
  const spotCount = spotsApi.tourSpots.length;

  /* ── Mutation helpers (reject so the cell can roll back on failure) ── */

  const patchDistrict = (id: string, data: { name?: string; division_value?: string; sort_order?: number; is_active?: boolean }) =>
    new Promise<void>((resolve, reject) => {
      districtsApi.updateDistrict({ id, data }, { onSuccess: () => resolve(), onError: reject });
    });

  const patchSpot = (
    id: string,
    data: { name?: string; district_id?: string; sort_order?: number; is_active?: boolean },
  ) =>
    new Promise<void>((resolve, reject) => {
      spotsApi.updateTourSpot({ id, data }, { onSuccess: () => resolve(), onError: reject });
    });

  const createDistrict = (data: { division_value: string; name: string; sort_order?: number; is_active?: boolean }) =>
    new Promise<PackageDistrict>((resolve, reject) => {
      districtsApi.createDistrict(data, { onSuccess: (result) => resolve(result.district), onError: reject });
    });

  const createSpot = (data: { district_id: string; name: string; sort_order?: number; is_active?: boolean }) =>
    new Promise<PackageTourSpot>((resolve, reject) => {
      spotsApi.createTourSpot(data, { onSuccess: (result) => resolve(result.tourSpot), onError: reject });
    });

  const findDistrict = (divisionValue: string, name: string) =>
    (districtsByDivision.get(divisionValue) ?? []).find(
      (district) => district.name.toLowerCase() === name.trim().toLowerCase(),
    );

  const findOrCreateDistrict = async (divisionValue: string, name: string) => {
    const existing = findDistrict(divisionValue, name);
    if (existing) return existing.id;
    const created = await createDistrict({ division_value: divisionValue, name: name.trim() });
    return created.id;
  };

  /* ── Row actions ─────────────────────────────────────────────────── */

  const moveSpotToDistrict = async (row: RegionRow, name: string) => {
    if (!row.spotId) return;
    const cleaned = name.trim();
    if (!cleaned) throw new Error('District is required');
    const divisionValue = spotDivision[row.spotId] ?? row.divisionValue;
    const districtId = await findOrCreateDistrict(divisionValue, cleaned);
    if (districtId !== row.districtId) {
      await patchSpot(row.spotId, { district_id: districtId });
    }
    setSpotDivision((prev) => {
      const next = { ...prev };
      delete next[row.spotId as string];
      return next;
    });
  };

  const addSpotToDistrict = async (row: RegionRow, name: string) => {
    const cleaned = name.trim();
    if (!cleaned) throw new Error('Tour spot name is required');
    const exists = (spotsByDistrict.get(row.districtId) ?? []).some(
      (spot) => spot.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (exists) {
      toast.error(`“${cleaned}” already exists in ${row.districtName}`);
      throw new Error('Duplicate tour spot');
    }
    await createSpot({ district_id: row.districtId, name: cleaned });
  };

  /* ── Row reordering ──────────────────────────────────────────────── */

  // District rows move among their division's districts; tour spots move among
  // their own district's spots. Each level keeps its own sort_order sequence.
  const rowByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  const groupOfRow = (row: RegionRow) =>
    row.kind === 'district' ? `division:${row.divisionValue}` : `spot:${row.districtId}`;

  /** Renumbers a division's districts 1..n, persisting only the rows that moved. */
  const applyDistrictOrder = (divisionValue: string, orderedIds: string[]) => {
    const sortById = new Map(orderedIds.map((id, index) => [id, index + 1]));
    const changed = orderedIds
      .map((id) => ({
        id,
        to: sortById.get(id) as number,
        from: districtsApi.districts.find((district) => district.id === id)?.sort_order,
      }))
      .filter((item) => item.from === undefined || item.from !== item.to);

    queryClient.setQueryData<DistrictOrderCache>(['admin-package-districts', undefined], (prev) =>
      prev
        ? {
            ...prev,
            districts: prev.districts.map((district) =>
              sortById.has(district.id) ? { ...district, sort_order: sortById.get(district.id) as number } : district,
            ),
          }
        : prev,
    );

    if (changed.length === 0) return;
    void Promise.allSettled(changed.map((item) => patchDistrict(item.id, { sort_order: item.to }))).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-package-districts'] }),
    );
  };

  /** Renumbers a district's tour spots 1..n, persisting only the rows that moved. */
  const applySpotOrder = (districtId: string, orderedIds: string[]) => {
    const sortById = new Map(orderedIds.map((id, index) => [id, index + 1]));
    const changed = orderedIds
      .map((id) => ({
        id,
        to: sortById.get(id) as number,
        from: spotsApi.tourSpots.find((spot) => spot.id === id)?.sort_order,
      }))
      .filter((item) => item.from === undefined || item.from !== item.to);

    queryClient.setQueryData<SpotOrderCache>(['admin-package-tour-spots', undefined], (prev) =>
      prev
        ? {
            ...prev,
            tourSpots: prev.tourSpots.map((spot) =>
              sortById.has(spot.id) ? { ...spot, sort_order: sortById.get(spot.id) as number } : spot,
            ),
          }
        : prev,
    );

    if (changed.length === 0) return;
    void Promise.allSettled(changed.map((item) => patchSpot(item.id, { sort_order: item.to }))).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-package-tour-spots'] }),
    );
  };

  /**
   * Saved rows reorder within the group that shares their sort_order sequence;
   * unsaved draft rows can be parked anywhere, since nothing is written until
   * they are saved.
   */
  const reorder = useSheetDrag({
    canDrop: (draggedId, targetId) => {
      if (draftKeys.has(draggedId)) return true;
      if (draftKeys.has(targetId)) return false;
      const dragged = rowByKey.get(draggedId);
      const target = rowByKey.get(targetId);
      return !!dragged && !!target && groupOfRow(dragged) === groupOfRow(target);
    },
    onDrop: (draggedId, targetId, position) => {
      if (draftKeys.has(draggedId)) {
        updateDraft(draggedId, { anchor: { key: targetId, side: position } });
        return;
      }
      const dragged = rowByKey.get(draggedId);
      if (!dragged) return;
      const group = groupOfRow(dragged);
      const siblings = rows.filter((row) => row.key !== draggedId && groupOfRow(row) === group).map((row) => row.key);
      const at = siblings.indexOf(targetId);
      if (at < 0) return;
      siblings.splice(position === 'before' ? at : at + 1, 0, draggedId);
      if (dragged.kind === 'district') applyDistrictOrder(dragged.divisionValue, siblings.map((key) => key.slice(2)));
      else applySpotOrder(dragged.districtId, siblings.map((key) => key.slice(2)));
    },
    onNudge: (id, delta) => {
      const side = delta === -1 ? ('before' as const) : ('after' as const);
      if (draftKeys.has(id)) {
        const index = renderedRows.findIndex((entry) => entry.kind === 'draft' && entry.draft.key === id);
        const neighbour = renderedRows[index + delta];
        if (index < 0 || !neighbour) return;
        updateDraft(id, { anchor: { key: neighbour.kind === 'row' ? neighbour.row.key : neighbour.draft.key, side } });
        return;
      }
      const dragged = rowByKey.get(id);
      if (!dragged) return;
      const group = groupOfRow(dragged);
      const siblings = rows.filter((row) => groupOfRow(row) === group).map((row) => row.key);
      const index = siblings.indexOf(id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= siblings.length) return;
      siblings.splice(index, 1);
      siblings.splice(next, 0, id);
      if (dragged.kind === 'district') applyDistrictOrder(dragged.divisionValue, siblings.map((key) => key.slice(2)));
      else applySpotOrder(dragged.districtId, siblings.map((key) => key.slice(2)));
    },
  });

  /* ── Draft rows ──────────────────────────────────────────────────── */

  // The draft anchors to whichever row the cursor sits in, so it renders there.
  const knownRowKeys = useMemo(
    () => new Set([...visibleRows.map((row) => row.key), ...draftKeys]),
    [visibleRows, draftKeys],
  );
  const anchorKey = activeRowKey && knownRowKeys.has(activeRowKey) ? activeRowKey : null;

  const nextDraftKey = () => `draft-${++draftSeq.current}`;

  const addDraft = () =>
    setDrafts((prev) => [
      ...prev,
      {
        key: nextDraftKey(),
        anchor: anchorKey ? { key: anchorKey, side: 'after' } : null,
        divisionValue: divisions[0]?.value ?? '',
        districtName: '',
        spotName: '',
        active: true,
      },
    ]);

  const dropDraft = (key: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.key !== key));
    setDraftErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActiveRowKey((prev) => (prev === key ? null : prev));
  };

  const setDraftError = (key: string, message: string) => setDraftErrors((prev) => ({ ...prev, [key]: message }));

  const draftReady = (draft: DraftRow) => draft.divisionValue.trim().length > 0 && draft.districtName.trim().length > 0;

  /** Follows a draft's anchor chain down to a saved row. */
  const resolveAnchorRow = (anchor: DraftAnchor | null): { row: RegionRow; side: 'before' | 'after' } | null => {
    const seen = new Set<string>();
    let current = anchor;
    while (current) {
      if (seen.has(current.key)) return null;
      seen.add(current.key);
      const draft = drafts.find((item) => item.key === current?.key);
      if (!draft) {
        const row = rowByKey.get(current.key);
        return row ? { row, side: current.side } : null;
      }
      current = draft.anchor;
    }
    return null;
  };

  const commitDraft = async (draft: DraftRow, options: { chain?: boolean } = {}) => {
    const districtName = draft.districtName.trim();
    const spotName = draft.spotName.trim();
    if (!draft.divisionValue || !districtName) {
      setDraftError(draft.key, 'Division and district are required.');
      return;
    }

    const anchor = resolveAnchorRow(draft.anchor);

    // Where the draft sits relative to the division's existing districts …
    const divisionDistrictIds = (districtsByDivision.get(draft.divisionValue) ?? []).map((district) => district.id);
    const anchorDistrictIndex =
      anchor && anchor.row.divisionValue === draft.divisionValue ? divisionDistrictIds.indexOf(anchor.row.districtId) : -1;
    const districtInsertAt =
      anchorDistrictIndex < 0
        ? divisionDistrictIds.length
        : anchor?.side === 'before'
          ? anchorDistrictIndex
          : anchorDistrictIndex + 1;

    try {
      const existing = findDistrict(draft.divisionValue, districtName);
      if (existing && !spotName) {
        setDraftError(draft.key, 'That district already exists — add a tour spot or edit its existing row.');
        return;
      }

      let districtId: string;
      if (existing) {
        districtId = existing.id;
      } else {
        const created = await createDistrict({
          division_value: draft.divisionValue,
          name: districtName,
          sort_order: districtInsertAt + 1,
          is_active: draft.active,
        });
        districtId = created.id;
        queryClient.setQueryData<DistrictOrderCache>(['admin-package-districts', undefined], (prev) =>
          prev ? { ...prev, districts: [...prev.districts, created] } : prev,
        );
        // Land it exactly where the draft sat, renumbering the division around it.
        const ordered = [...divisionDistrictIds];
        ordered.splice(districtInsertAt, 0, created.id);
        applyDistrictOrder(draft.divisionValue, ordered);
      }

      let savedKey = `d:${districtId}`;
      if (spotName) {
        const duplicate = (spotsByDistrict.get(districtId) ?? []).some(
          (spot) => spot.name.toLowerCase() === spotName.toLowerCase(),
        );
        if (duplicate) {
          setDraftError(draft.key, 'That tour spot already exists in this district.');
          return;
        }

        // … and where it sits among that district's tour spots.
        const spotIds = (spotsByDistrict.get(districtId) ?? []).map((spot) => spot.id);
        const anchorSpotIndex =
          anchor && anchor.row.kind === 'spot' && anchor.row.districtId === districtId
            ? spotIds.indexOf(anchor.row.spotId as string)
            : -1;
        const anchorIsDistrictRow =
          !!anchor && anchor.row.kind === 'district' && anchor.row.districtId === districtId;
        const spotInsertAt = anchorIsDistrictRow
          ? 0
          : anchorSpotIndex < 0
            ? spotIds.length
            : anchor?.side === 'before'
              ? anchorSpotIndex
              : anchorSpotIndex + 1;

        const createdSpot = await createSpot({
          district_id: districtId,
          name: spotName,
          sort_order: spotInsertAt + 1,
          is_active: draft.active,
        });
        queryClient.setQueryData<SpotOrderCache>(['admin-package-tour-spots', undefined], (prev) =>
          prev ? { ...prev, tourSpots: [...prev.tourSpots, createdSpot] } : prev,
        );
        const ordered = [...spotIds];
        ordered.splice(spotInsertAt, 0, createdSpot.id);
        applySpotOrder(districtId, ordered);
        savedKey = `s:${createdSpot.id}`;
      }

      // Anything parked under the row we just saved now follows the saved row,
      // and the draft itself is done with.
      setDrafts((prev) =>
        prev
          .filter((other) => other.key !== draft.key)
          .map((other) =>
            other.anchor && other.anchor.key === draft.key
              ? { ...other, anchor: { key: savedKey, side: 'after' } }
              : other,
          ),
      );
      setDraftErrors((prev) => {
        const next = { ...prev };
        delete next[draft.key];
        return next;
      });
      if (activeRowKey === draft.key) setActiveRowKey(savedKey);

      // Enter keeps the streak going: a fresh row in the same division underneath.
      if (options.chain) {
        setDrafts((prev) => [
          ...prev,
          {
            key: nextDraftKey(),
            anchor: { key: savedKey, side: 'after' },
            divisionValue: draft.divisionValue,
            districtName: '',
            spotName: '',
            active: draft.active,
          },
        ]);
      }
    } catch {
      setDraftError(draft.key, 'Could not save this row.');
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Bangladesh Divisions, Districts &amp; Tour Spots
            <Badge variant="secondary" className="ml-1 text-xs font-medium">
              {districtCount} districts · {spotCount} spots
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter regions…"
                className="h-9 w-52 pl-8 text-sm"
              />
            </div>
            <select
              value={divisionFilter}
              onChange={(event) => setDivisionFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All divisions</option>
              {divisionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
              disabled={divisions.length === 0}
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
            Loading regions…
          </div>
        ) : (
          <>
            <SheetGrid>
              <SheetTable>
                <thead>
                  <tr>
                    <SheetHeadCell stickyLeft className="w-10 px-1" />
                    <SheetHeadCell className="w-[15%]">Division</SheetHeadCell>
                    <SheetHeadCell className="w-[20%]">District</SheetHeadCell>
                    <SheetHeadCell className="w-[24%]">Tour spot</SheetHeadCell>
                    <SheetHeadCell className="w-20 text-right">Sort</SheetHeadCell>
                    <SheetHeadCell className="w-16 text-center">Active</SheetHeadCell>
                    <SheetHeadCell className="w-20 text-center">Row</SheetHeadCell>
                  </tr>
                </thead>
                <SheetBody>
                  {renderedRows.map((entry, index) => {
                    if (entry.kind === 'row') {
                    const row = entry.row;
                    const override = row.spotId ? spotDivision[row.spotId] : undefined;
                    const divisionValue = override ?? row.divisionValue;
                    const districtOptions = (districtsByDivision.get(divisionValue) ?? [])
                      .filter((district) => district.id !== row.districtId)
                      .map((district) => district.name);
                    const spotOptions = (spotsByDistrict.get(row.districtId) ?? [])
                      .filter((spot) => spot.id !== row.spotId)
                      .map((spot) => spot.name);
                    const faded = !row.isActive;

                    return (
                      <tr
                        key={row.key}
                        onFocus={() => setActiveRowKey(row.key)}
                        className={cn(
                          'group',
                          row.kind === 'district' && 'bg-muted/25',
                          reorder.draggingId === row.key && 'opacity-50',
                          dropIndicatorClass(reorder.dropTarget?.id === row.key ? reorder.dropTarget.position : null),
                        )}
                        {...reorder.rowProps(row.key)}
                      >
                        <SheetGutterCell
                          muted={row.kind === 'spot' || faded}
                          reorder={{
                            label: `Reorder ${row.spotName || row.districtName}`,
                            dragging: reorder.draggingId === row.key,
                            onDragStart: reorder.startDrag(row.key),
                            onDragEnd: reorder.endDrag,
                            onMoveBy: (delta) => reorder.moveBy(row.key, delta),
                          }}
                        >
                          {row.districtOrdinal}
                        </SheetGutterCell>

                        <SheetSelectCell
                          row={index}
                          col={1}
                          value={divisionValue}
                          options={divisionOptions}
                          ariaLabel={`Division for ${row.districtName}`}
                          onCommit={(next) => {
                            if (!next) return;
                            if (row.kind === 'district') {
                              void patchDistrict(row.districtId, { division_value: next });
                              return;
                            }
                            const spotId = row.spotId as string;
                            setSpotDivision((prev) => {
                              const copy = { ...prev };
                              if (next === row.divisionValue) delete copy[spotId];
                              else copy[spotId] = next;
                              return copy;
                            });
                          }}
                          className={cn(faded && 'opacity-60')}
                        />

                        {row.kind === 'district' ? (
                          <SheetInputCell
                            row={index}
                            col={2}
                            value={row.districtName}
                            options={districtOptions}
                            ariaLabel={`District name ${row.districtName}`}
                            onCommit={(next) =>
                              next
                                ? patchDistrict(row.districtId, { name: next })
                                : Promise.reject(new Error('District name is required'))
                            }
                            className={cn(faded && 'opacity-60')}
                          />
                        ) : (
                          <SheetInputCell
                            row={index}
                            col={2}
                            value={override ? '' : row.districtName}
                            options={districtOptions}
                            placeholder={override ? 'Pick or type a district…' : undefined}
                            ariaLabel={`District for tour spot ${row.spotName}`}
                            onCommit={(next) => moveSpotToDistrict(row, next)}
                            className={cn(faded && 'opacity-60')}
                          />
                        )}

                        {row.kind === 'spot' ? (
                          <SheetInputCell
                            row={index}
                            col={3}
                            value={row.spotName}
                            options={spotOptions}
                            ariaLabel={`Tour spot ${row.spotName}`}
                            onCommit={(next) =>
                              next
                                ? patchSpot(row.spotId as string, { name: next })
                                : Promise.reject(new Error('Tour spot name is required'))
                            }
                            className={cn(faded && 'opacity-60')}
                          />
                        ) : (
                          <SheetInputCell
                            row={index}
                            col={3}
                            value=""
                            placeholder="+ add tour spot"
                            title="Type a tour spot name and press Enter to add it under this district"
                            ariaLabel={`Add tour spot to ${row.districtName}`}
                            clearOnCommit
                            onCommit={(next) => addSpotToDistrict(row, next)}
                          />
                        )}

                        <SheetInputCell
                          row={index}
                          col={4}
                          type="number"
                          align="right"
                          value={String(row.sortOrder)}
                          ariaLabel="Sort order"
                          onCommit={(next) =>
                            row.kind === 'district'
                              ? patchDistrict(row.districtId, { sort_order: Number(next) || 0 })
                              : patchSpot(row.spotId as string, { sort_order: Number(next) || 0 })
                          }
                          className={cn(faded && 'opacity-60')}
                        />

                        <SheetToggleCell
                          row={index}
                          col={5}
                          checked={row.isActive}
                          ariaLabel={`Toggle ${row.spotName || row.districtName}`}
                          onCommit={(next) =>
                            row.kind === 'district'
                              ? patchDistrict(row.districtId, { is_active: next })
                              : patchSpot(row.spotId as string, { is_active: next })
                          }
                        />

                        <SheetDeleteCell
                          label={row.spotName || `${row.districtName} (and its tour spots)`}
                          onDelete={() =>
                            row.kind === 'district'
                              ? new Promise<void>((resolve, reject) => {
                                  districtsApi.deleteDistrict(row.districtId, {
                                    onSuccess: () => resolve(),
                                    onError: reject,
                                  });
                                })
                              : new Promise<void>((resolve, reject) => {
                                  spotsApi.deleteTourSpot(row.spotId as string, {
                                    onSuccess: () => resolve(),
                                    onError: reject,
                                  });
                                })
                          }
                          className="w-20"
                        />
                      </tr>
                    );
                    }

                    const draft = entry.draft;
                    const row = index;
                    const draftDistrictOptions = (districtsByDivision.get(draft.divisionValue) ?? []).map(
                      (district) => district.name,
                    );
                    const draftSpotOptions = draft.districtName
                      ? (spotsByDistrict.get(findDistrict(draft.divisionValue, draft.districtName)?.id ?? '') ?? []).map(
                          (spot) => spot.name,
                        )
                      : [];
                    const error = draftErrors[draft.key];

                    return [
                      <tr
                        key={draft.key}
                        onFocus={() => setActiveRowKey(draft.key)}
                        className={cn(
                          'group bg-primary/[0.03]',
                          reorder.draggingId === draft.key && 'opacity-50',
                          dropIndicatorClass(
                            reorder.dropTarget?.id === draft.key ? reorder.dropTarget.position : null,
                          ),
                        )}
                        {...reorder.rowProps(draft.key)}
                      >
                        <SheetGutterCell
                          reorder={{
                            label: `Move unsaved row${draft.districtName ? ` ${draft.districtName}` : ''}`,
                            dragging: reorder.draggingId === draft.key,
                            onDragStart: reorder.startDrag(draft.key),
                            onDragEnd: reorder.endDrag,
                            onMoveBy: (delta) => reorder.moveBy(draft.key, delta),
                          }}
                        >
                          <Plus className="h-3 w-3 text-primary" />
                        </SheetGutterCell>
                        <SheetSelectCell
                          row={row}
                          col={1}
                          value={draft.divisionValue}
                          options={divisionOptions}
                          ariaLabel="New row division"
                          onCommit={(next) => updateDraft(draft.key, { divisionValue: next })}
                        />
                        <SheetInputCell
                          row={row}
                          col={2}
                          value={draft.districtName}
                          options={draftDistrictOptions}
                          placeholder="District"
                          autoFocus
                          ariaLabel="New row district"
                          onCommit={(next) => updateDraft(draft.key, { districtName: next })}
                        />
                        <SheetInputCell
                          row={row}
                          col={3}
                          value={draft.spotName}
                          options={draftSpotOptions}
                          placeholder="Tour spot (optional)"
                          ariaLabel="New row tour spot"
                          onCommit={(next) => updateDraft(draft.key, { spotName: next })}
                          onSubmit={(value) => void commitDraft({ ...draft, spotName: value }, { chain: true })}
                        />
                        <td
                          className="border-b border-r border-border p-0 align-middle"
                          title="Position comes from where this row sits — it is numbered on save"
                        >
                          <span className="block px-3 text-right text-xs text-muted-foreground">auto</span>
                        </td>
                        <SheetToggleCell
                          row={row}
                          col={5}
                          checked={draft.active}
                          ariaLabel="New row active"
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
                      </tr>,
                      error ? (
                        <tr key={`${draft.key}-error`}>
                          <td colSpan={7} className="border-b border-border bg-destructive/5 px-4 py-1.5 text-xs text-destructive">
                            {error}
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}

                  {renderedRows.length === 0 && (
                    <SheetEmptyRow colSpan={7}>
                      {divisions.length === 0
                        ? 'No Bangladesh divisions found — add divisions under Package Builder Destinations first.'
                        : 'No regions match this filter.'}
                    </SheetEmptyRow>
                  )}
                </SheetBody>
              </SheetTable>
            </SheetGrid>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SheetHints>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" /> shaded row = the district itself
                </span>
                <span className="inline-flex items-center gap-1.5">districts reorder within a division, spots within a district</span>
                <span className="inline-flex items-center gap-1.5">
                  unsaved rows can be dragged too — they are numbered where you drop them
                </span>
              </SheetHints>
              <p className="pt-3 text-[11px] text-muted-foreground">
                {visibleRows.length} of {rows.length} rows
                {drafts.length > 0 && ` · ${drafts.length} unsaved`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
