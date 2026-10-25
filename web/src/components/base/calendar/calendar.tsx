import { useContext, type ButtonHTMLAttributes } from "react";
import {
  startOfMonth,
  endOfMonth,
  today,
  getLocalTimeZone,
  toCalendarDate,
  type CalendarDate,
} from "@internationalized/date";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@/components/ui/icons";
import {
  Button as RACButton,
  Calendar as RACCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarStateContext,
  Heading,
  RangeCalendar as RACRangeCalendar,
  RangeCalendarStateContext,
  type CalendarProps as RACCalendarProps,
  type DateValue,
  type RangeCalendarProps as RACRangeCalendarProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";

/* ── Shared nav button styling ─────────────────────────────────────── */
const navButtonClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/10";

/* ── Year navigation (outer corners of the header) ─────────────────── */
function YearNavButton({
  direction,
  yearsPerPage,
}: {
  direction: "previous" | "next";
  yearsPerPage: number;
}) {
  const calendarState = useContext(CalendarStateContext);
  const rangeCalendarState = useContext(RangeCalendarStateContext);
  const state = calendarState ?? rangeCalendarState;
  if (!state) return null;

  const step = { years: yearsPerPage };
  const raw =
    direction === "next"
      ? state.visibleRange.start.add(step)
      : state.visibleRange.start.subtract(step);
  let target: CalendarDate = toCalendarDate(raw);
  if (state.minValue && target.compare(toCalendarDate(state.minValue)) < 0) {
    target = toCalendarDate(state.minValue);
  }
  if (state.maxValue && target.compare(toCalendarDate(state.maxValue)) > 0) {
    target = toCalendarDate(state.maxValue);
  }
  const startYear = state.visibleRange.start.year;
  const isDisabled =
    (direction === "next"
      ? state.isNextVisibleRangeInvalid()
      : state.isPreviousVisibleRangeInvalid()) ||
    (direction === "next" ? target.year <= startYear : target.year >= startYear);

  const Icon = direction === "next" ? ChevronsRight : ChevronsLeft;

  return (
    <button
      type="button"
      aria-label={direction === "next" ? "Next year" : "Previous year"}
      disabled={isDisabled}
      onClick={() => state.setFocusedDate(target)}
      className={navButtonClass}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

/* ── Shared calendar body (header nav + grid) ─────────────────────── */
function CalendarBody({ className, isRange = false }: { className?: string; isRange?: boolean }) {
  const yearsPerPage = isRange ? 2 : 1;

  return (
    <>
      <div className="flex items-center px-1 pb-2">
        {/* Year: outer left corner (reads calendar state from context) */}
        <YearNavButton direction="previous" yearsPerPage={yearsPerPage} />
        {/* Month: RAC slot buttons wired to focusPreviousPage/focusNextPage */}
        <RACButton slot="previous" className={cn(navButtonClass, "ml-0.5")}>
          <ChevronLeft aria-hidden className="size-4" />
        </RACButton>
        <Heading className="mx-auto flex-1 text-center text-sm font-semibold text-foreground" />
        <RACButton slot="next" className={cn(navButtonClass, "mr-0.5")}>
          <ChevronRight aria-hidden className="size-4" />
        </RACButton>
        {/* Year: outer right corner */}
        <YearNavButton direction="next" yearsPerPage={yearsPerPage} />
      </div>
      <CalendarGrid
        weekdayStyle="short"
        className={cn("w-full border-collapse", className)}
      >
        <CalendarGridHeader className="[&_th]:pb-2 [&_th]:text-center [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          {(day) => <CalendarHeaderCell key={day} />}
        </CalendarGridHeader>
        <CalendarGridBody className="[&_td]:p-0">
          {(date) => (
            <CalendarCell
              date={date}
              className={({
                isSelected,
                isSelectionStart,
                isSelectionEnd,
                isOutsideMonth,
                isDisabled,
                isFocusVisible,
              }) =>
                cn(
                  "relative flex size-9 items-center justify-center rounded-full text-sm tabular-nums outline-none transition-colors",
                  "[&[aria-current=date]]:font-semibold [&[aria-current=date]]:text-foreground",
                  isOutsideMonth
                    ? "invisible"
                    : "text-foreground hover:bg-white/45 hover:text-foreground dark:hover:bg-white/10",
                  // Range middle days: muted band between the two endpoints
                  isRange &&
                    isSelected &&
                    !isSelectionStart &&
                    !isSelectionEnd &&
                    "rounded-none bg-white/35 font-normal text-foreground hover:bg-white/45 dark:bg-white/10 dark:hover:bg-white/15",
                  // Selected day: single-date selection or range endpoints
                  isSelected &&
                    (!isRange || isSelectionStart || isSelectionEnd) &&
                    "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                  isDisabled && "pointer-events-none opacity-40",
                  isFocusVisible && "z-10 ring-2 ring-ring",
                )
              }
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </>
  );
}

/* ── Single-date calendar ──────────────────────────────────────────── */
export function Calendar({ className, ...props }: RACCalendarProps<DateValue>) {
  return (
    <RACCalendar className={cn("flex flex-col", className)} {...props}>
      <CalendarBody isRange={false} />
    </RACCalendar>
  );
}

/* ── Range presets ─────────────────────────────────────────────────── */
export type RangePreset = {
  label: string;
  value: (now: CalendarDate) => { start: CalendarDate; end: CalendarDate };
};

const DEFAULT_RANGE_PRESETS: RangePreset[] = [
  { label: "Today", value: (now) => ({ start: now, end: now }) },
  {
    label: "Next 7 days",
    value: (now) => ({ start: now, end: now.add({ days: 6 }) }),
  },
  {
    label: "Next 30 days",
    value: (now) => ({ start: now, end: now.add({ days: 29 }) }),
  },
  {
    label: "Next month",
    value: (now) => {
      const nextMonth = now.add({ months: 1 });
      return { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
    },
  },
];

export function RangePresetButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10",
        className,
      )}
      {...props}
    />
  );
}

/* ── Range preset footer (applies presets through the calendar state) ─ */
function RangePresetFooter({ presets }: { presets: RangePreset[] }) {
  const state = useContext(RangeCalendarStateContext);
  if (!state) return null;
  const now = today(getLocalTimeZone());

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border p-2">
      {presets.map((preset) => {
        const range = preset.value(now);
        return (
          <RangePresetButton
            key={preset.label}
            onClick={() => {
              state.setValue(range);
              state.setFocusedDate(range.start);
            }}
          >
            {preset.label}
          </RangePresetButton>
        );
      })}
    </div>
  );
}

/* ── Range calendar with preset footer ────────────────────────────── */
export function RangeCalendar({
  className,
  presets = DEFAULT_RANGE_PRESETS,
  ...props
}: RACRangeCalendarProps<DateValue> & { presets?: RangePreset[] | null }) {
  return (
    <RACRangeCalendar className={cn("flex flex-col", className)} {...props}>
      <CalendarBody isRange />
      {presets && presets.length > 0 ? <RangePresetFooter presets={presets} /> : null}
    </RACRangeCalendar>
  );
}
