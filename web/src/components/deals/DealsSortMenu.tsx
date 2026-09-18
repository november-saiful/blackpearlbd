import { ArrowUpDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEAL_SORT_OPTIONS, isDealSort, type DealSort } from './deals-sort';

interface DealsSortMenuProps {
  /** The sort in force. The page owns it, so the grid and the menu agree. */
  value: DealSort;
  onChange: (sort: DealSort) => void;
}

/**
 * The sort order, as an icon button beside the filter bar.
 *
 * A menu rather than a select so the control can be one square in the corner of
 * the toolbar, level with the bar's own Add filter button: the four orders are
 * a list of alternatives, not a value being typed, and a menu says that with
 * one glyph where a select has to spell the current one out in a full-width
 * box. The button is drawn `size="icon"` on purpose - the same rung the filter
 * bar's own trailing button takes, so the two line up at every breakpoint.
 *
 * An icon carries no label of its own, so the ORDER IN FORCE is in the button's
 * accessible name and its tooltip, and the menu ticks the row that is on for
 * anyone who opens it.
 */
export function DealsSortMenu({ value, onChange }: DealsSortMenuProps) {
  const active = DEAL_SORT_OPTIONS.find((option) => option.value === value) ?? DEAL_SORT_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Sort tours: ${active.label}`}
          title={`Sort: ${active.label}`}
          className="shrink-0"
        >
          <ArrowUpDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            // The menu only ever offers the orders above, so this guard is the
            // type's price, not a runtime possibility.
            if (isDealSort(next)) onChange(next);
          }}
        >
          {DEAL_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer">
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
