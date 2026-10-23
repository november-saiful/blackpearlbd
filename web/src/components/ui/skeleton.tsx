import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * The library's own `Skeleton` forces an inline `width: 100%`, which would beat
 * the `w-*` utilities every call site sizes it with. The recipe class carries
 * the material: the control glass fill and the pill radius, without that, so
 * the element stays a div shaped by its className and keeps the pulse.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ogui-skeleton animate-pulse", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }