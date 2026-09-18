'use client';

import { Fragment, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  useComboboxContext,
} from '@/components/ui/combobox';
import { usePackageDestinations } from '@/hooks/useAdmin';
import {
  buildDestinationOptions,
  groupDestinationOptions,
  type DestinationOption,
} from './deals-destination';

/**
 * The menu body.
 *
 * It filters the rows itself instead of leaving it to `ComboboxItem` so the
 * headings and separators disappear along with their contents, and so an empty
 * result gets one honest line rather than a heading with nothing under it.
 * `ComboboxItem` still applies the same test on its way out, so the two agree.
 */
function DestinationGroups({ options }: { options: DestinationOption[] }) {
  const { search } = useComboboxContext();
  const groups = useMemo(() => groupDestinationOptions(options, search), [options, search]);

  if (groups.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
        No destination matches “{search.trim()}”.
      </p>
    );
  }

  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group.category}>
          {index > 0 ? <ComboboxSeparator /> : null}
          <ComboboxGroup label={group.category}>
            {group.items.map((option) => (
              <ComboboxItem
                key={option.name}
                value={option.name}
                textValue={option.name}
                // The heading is searchable too, so "asia" finds the countries
                // under it rather than nothing.
                keywords={[option.category]}
                className="py-2"
              >
                {option.name}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </Fragment>
      ))}
    </>
  );
}

export type DealDestinationPickerProps = {
  /** The deal's destination, i.e. `tour_deals.destination`. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
};

/**
 * Destination as a selection, not a typing exercise.
 *
 * Deal destinations used to be free text, which is how the catalogue ended up
 * with rows reading "uyiyui" and "gdfgdfg" beside "Cox's Bazar" — and every one
 * of those values is its own option in the /deals destination filter. The list
 * is the one the admin already curates for the package builder, so the two
 * features name places the same way.
 */
export function DealDestinationPicker({ value, onChange, id, className }: DealDestinationPickerProps) {
  const { destinations, isLoading, isError } = usePackageDestinations();
  const options = useMemo(() => buildDestinationOptions(destinations, value), [destinations, value]);
  const current = options.find((option) => option.name === value);

  return (
    <div className={className}>
      <Combobox value={value} onValueChange={onChange} className="w-full">
        <ComboboxTrigger id={id} aria-label="Deal destination">
          {value ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{value}</span>
              {current ? (
                <span className="shrink-0 text-xs text-muted-foreground">{current.category}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Select destination</span>
          )}
        </ComboboxTrigger>
        <ComboboxContent className="w-full">
          <ComboboxInput placeholder="Search destinations..." />
          <ComboboxList className="max-h-72">
            {isLoading ? (
              <p className="flex items-center justify-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading destinations…
              </p>
            ) : options.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No destinations yet — add them under Package Builder Destinations.
              </p>
            ) : (
              <DestinationGroups options={options} />
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {isError ? (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Could not load the destination list. The saved destination is unchanged.
        </p>
      ) : null}
    </div>
  );
}
