'use client';

import { Fragment, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePackageDestinations } from '@/hooks/useAdmin';
import { api } from '@/lib/api';
import {
  buildDestinationOptions,
  groupDestinationOptions,
  type DestinationOption,
} from './deals-destination';

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
  /** The selected division/country, stored as `tour_deals.destination`. */
  value: string;
  /** The selected district/place under a division, stored separately. */
  subDestination?: string;
  onChange: (selection: { destination: string; subDestination: string }) => void;
  id?: string;
  className?: string;
};

/**
 * Selects a parent destination first, then loads its dependent places. The
 * parent remains the deal's destination while the child is stored separately,
 * allowing public pages to render "Sub-destination, Destination" without
 * losing the division grouping.
 */
export function DealDestinationPicker({
  value,
  subDestination = '',
  onChange,
  id,
  className,
}: DealDestinationPickerProps) {
  const { destinations, isLoading, isError } = usePackageDestinations();
  const options = useMemo(() => buildDestinationOptions(destinations, value), [destinations, value]);
  const current = destinations.find((destination) => destination.name === value);
  const divisionValue = current?.value.endsWith('-division') ? current.value : '';

  const districtsQuery = useQuery({
    queryKey: ['deal-destination-districts', divisionValue],
    queryFn: () => api.getPackageDistricts(divisionValue),
    enabled: Boolean(divisionValue),
  });
  const districts = districtsQuery.data?.districts || [];

  return (
    <div className={className}>
      <div className="space-y-2">
        <Combobox
          value={value}
          onValueChange={(destination) => onChange({ destination, subDestination: '' })}
          className="w-full"
        >
          <ComboboxTrigger id={id} aria-label="Deal destination">
            {value ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-foreground">{value}</span>
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

        {divisionValue && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sub-destination</Label>
            <Select
            value={subDestination || undefined}
            onValueChange={(subDestination) =>
              onChange({ destination: value, subDestination })
            }
            disabled={districtsQuery.isLoading || districts.length === 0}
          >
            <SelectTrigger aria-label="Deal sub-destination">
              <SelectValue
                placeholder={
                  districtsQuery.isLoading
                    ? 'Loading sub-destinations…'
                    : 'Select sub-destination'
                }
              />
            </SelectTrigger>
              <SelectContent>
                {districts.map((district) => (
                  <SelectItem key={district.id} value={district.name}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isError ? (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Could not load the destination list. The saved destination is unchanged.
        </p>
      ) : null}
      {divisionValue && districtsQuery.isError ? (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Could not load sub-destinations for this division.
        </p>
      ) : null}
    </div>
  );
}
