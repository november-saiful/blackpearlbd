import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import type { ButtonVariant, ControlSize } from "open-glass-ui"
import { cn } from "@/lib/utils"

/*
 * The glass on this button is OpenGlass's: the recipe's own class vocabulary
 * (`ogui-button`, `ogui-button--*`, `ogui-control--*`) driven by the theme
 * tokens the GlassSystemProvider sets on the app root.
 *
 * Why not the `<Button>` recipe component itself: it is a plain function
 * component that forwards no ref, and this app hands a ref to Button in every
 * Radix `asChild` trigger (the deals sort menu, the profile popover, both
 * topbar popovers). Dropping that ref is what parks a popper at
 * `translate(0, -200%)`: off-screen and untappable. A real <button> keeps the
 * ref (and `asChild`) while still wearing the recipe's classes.
 */

// The site's original variant/size names, mapped onto OpenGlass's, so the ~200
// existing call sites keep their props. `link` has no recipe counterpart: it is
// a quiet button underlined like a link.
const VARIANTS = {
  default: "primary",
  destructive: "danger",
  outline: "secondary",
  secondary: "secondary",
  ghost: "quiet",
  link: "quiet",
} as const satisfies Record<string, ButtonVariant>

const SIZES = {
  default: "medium",
  sm: "small",
  lg: "large",
  icon: "medium",
  "icon-sm": "small",
} as const satisfies Record<string, ControlSize>

// Icon rungs carry the site's exact square dimensions instead of the recipe's
// control height; the topbar and dock grids are laid out around them.
const ICON_SIZES = {
  icon: "ogui-icon-button h-10 w-10 min-h-0",
  "icon-sm": "ogui-icon-button h-9 w-9 min-h-0",
} as const

export type ButtonVariantName = keyof typeof VARIANTS
export type ButtonSizeName = keyof typeof SIZES

export function buttonClasses(
  variant: ButtonVariantName = "default",
  size: ButtonSizeName = "default",
  className?: string,
) {
  return cn(
    "ogui-button whitespace-nowrap",
    `ogui-button--${VARIANTS[variant]}`,
    `ogui-control--${SIZES[size]}`,
    size in ICON_SIZES ? ICON_SIZES[size as keyof typeof ICON_SIZES] : null,
    variant === "link" && "underline underline-offset-4",
    // Size the icons that carry no size of their own without overriding the
    // ones that do.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariantName
  size?: ButtonSizeName
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  },
)
Button.displayName = "Button"

export { Button }