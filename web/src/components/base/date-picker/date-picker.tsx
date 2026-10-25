import { useRef } from "react";
import { CalendarIcon } from "@/components/ui/icons";
import {
  Button as RACButton,
  DatePicker as RACDatePicker,
  Dialog as RACDialog,
  Modal,
  ModalOverlay,
  type DatePickerProps as RACDatePickerProps,
  type DateValue,
} from "react-aria-components";
import { getLocalTimeZone } from "@internationalized/date";
import { useDateFormatter } from "react-aria";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/base/calendar/calendar";
import { cn } from "@/lib/utils";

/* ── Screen-centered overlay shared by both pickers ───────────────── */
export function PickerOverlay({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ModalOverlay
      isDismissable
      className={({ isEntering }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4",
          "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:duration-150",
          isEntering && "animate-in fade-in-0 duration-150",
          className,
        )
      }
    >
      <Modal
        className={cn(
          "glass-strong w-80 max-w-[calc(100vw-2rem)] rounded-xl p-3 outline-none",
          "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[entering]:duration-150",
        )}
      >
        <RACDialog aria-label={label} className="w-full rounded-xl p-0 outline-none">
          {children}
        </RACDialog>
      </Modal>
    </ModalOverlay>
  );
}

/* ── OK / Cancel footer: Cancel restores the value from when the picker opened ── */
export function PickerFooter({
  getSnapshot,
  restore,
  close,
}: {
  getSnapshot: () => unknown;
  restore: (snapshot: unknown) => void;
  close: () => void;
}) {
  // The footer only mounts while the overlay is open, so the first
  // snapshot is the value the picker had when it opened.
  const snapshotRef = useRef<unknown>(getSnapshot());

  return (
    <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          restore(snapshotRef.current);
          close();
        }}
      >
        Cancel
      </Button>
      <Button type="button" size="sm" onClick={close}>
        OK
      </Button>
    </div>
  );
}

/* ── Single date picker ────────────────────────────────────────────── */
export function DatePicker({
  className,
  ...props
}: Omit<RACDatePickerProps<DateValue>, "children">) {
  const formatter = useDateFormatter({ day: "numeric", month: "short", year: "numeric" });

  return (
    <RACDatePicker
      shouldCloseOnSelect={false}
      className={cn("w-full", className)}
      {...props}
    >
      {({ state }) => (
        <>
          {/* Whole field is the trigger, click anywhere opens the calendar */}
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
              {state.value
                ? formatter.format(state.value.toDate(getLocalTimeZone()))
                : "Select date"}
            </span>
          </RACButton>
          <PickerOverlay label="Choose a date">
            <div className="flex flex-col">
              <Calendar />
              <PickerFooter
                getSnapshot={() => state.value}
                restore={(snapshot) => state.setValue(snapshot as DateValue | null)}
                close={() => state.setOpen(false)}
              />
            </div>
          </PickerOverlay>
        </>
      )}
    </RACDatePicker>
  );
}
