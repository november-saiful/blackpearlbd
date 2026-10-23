import { CalendarIcon } from "lucide-react";
import {
  Button as RACButton,
  DateRangePicker as RACDateRangePicker,
  Dialog as RACDialog,
  type DateRangePickerProps as RACDateRangePickerProps,
  type DateValue,
} from "react-aria-components";
import { getLocalTimeZone } from "@internationalized/date";
import { useDateFormatter } from "react-aria";
import { Button } from "@/components/ui/button";
import { RangeCalendar } from "@/components/base/calendar/calendar";
import { PickerFooter, PickerOverlay } from "@/components/base/date-picker/date-picker";
import { cn } from "@/lib/utils";

/* ── Date range picker ─────────────────────────────────────────────── */
export function DateRangePicker({
  className,
  ...props
}: Omit<RACDateRangePickerProps<DateValue>, "children">) {
  const formatter = useDateFormatter({ day: "numeric", month: "short", year: "numeric" });

  return (
    <RACDateRangePicker shouldCloseOnSelect={false} className={cn("w-full", className)} {...props}>
      {({ state }) => (
        <>
          {/* Whole field is the trigger, click anywhere opens the range calendar */}
          <RACButton
            className={({ isHovered, isFocusVisible }) =>
              cn(
                "glass-field flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors",
                isHovered && "bg-accent/50",
                isFocusVisible && "border-foreground/40 outline-none ring-2 ring-ring/20",
              )
            }
          >
            <CalendarIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "flex-1 truncate text-left",
                !state.value && "text-muted-foreground",
              )}
            >
              {state.value && state.value.start && state.value.end
                ? `${formatter.format(state.value.start.toDate(getLocalTimeZone()))} to ${formatter.format(state.value.end.toDate(getLocalTimeZone()))}`
                : "Select date range"}
            </span>
          </RACButton>
          <PickerOverlay label="Choose a date range">
            <div className="flex flex-col">
              <RangeCalendar />
              <PickerFooter
                getSnapshot={() => state.value}
                restore={(snapshot) =>
                  state.setValue(snapshot as unknown as Parameters<
                    typeof state.setValue
                  >[0])
                }
                close={() => state.setOpen(false)}
              />
            </div>
          </PickerOverlay>
        </>
      )}
    </RACDateRangePicker>
  );
}
