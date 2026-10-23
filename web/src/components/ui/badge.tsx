import * as React from "react"
import type { SemanticTone } from "open-glass-ui"
import { cn } from "@/lib/utils"

/*
 * The site's variant names, mapped onto OpenGlass's semantic tones. The recipe's
 * own class does the painting, `data-tone` picks the tone colour, the liquid
 * scope supplies the glass, so a badge here is identical to the library's own
 * `<Badge tone>`.
 *
 * The element stays a div: the library's Badge renders a span, and a few grids
 * use the site's badges as block-level cells. Callers that pass their own
 * palette utilities (getStatusColor, getTierColor) still win, because Tailwind
 * is imported after the library and both selectors carry the same specificity.
 */
const TONES = {
  default: "accent",
  secondary: "neutral",
  destructive: "danger",
  outline: "neutral",
  success: "positive",
  warning: "warning",
} as const satisfies Record<string, SemanticTone>

export type BadgeVariant = keyof typeof TONES

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      data-tone={TONES[variant]}
      className={cn("ogui-badge", className)}
      {...props}
    />
  )
}

export { Badge }