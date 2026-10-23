import {
  DateInput as RACDateInput,
  DateSegment as RACDateSegment,
  type DateInputProps as RACDateInputProps,
  type DateSegmentProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";

export function DateInput({ className, ...props }: RACDateInputProps) {
  return (
    <RACDateInput
      className={(values) =>
        cn(
          "glass-field flex h-10 w-full min-w-0 items-center gap-0.5 rounded-lg px-3 py-2 text-sm text-foreground",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          typeof className === "function" ? className(values) : className,
        )
      }
      {...props}
    />
  );
}

export function DateSegment({
  className,
  ...props
}: Omit<DateSegmentProps, "className"> & { className?: string }) {
  return (
    <RACDateSegment
      className={({ isPlaceholder, isInvalid, isFocused, type }) =>
        cn(
          "inline-flex rounded px-0.5 py-0.5 caret-transparent outline-none tabular-nums",
          type === "literal" && "text-muted-foreground",
          isPlaceholder ? "text-muted-foreground" : "text-foreground",
          isInvalid && "text-destructive",
          isFocused && "bg-white/55 text-foreground dark:bg-white/10",
          className,
        )
      }
      {...props}
    />
  );
}
