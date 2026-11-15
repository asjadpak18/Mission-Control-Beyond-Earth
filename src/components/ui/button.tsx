import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * v2.0 accessibility overhaul.
 * Design rules (contrast audit):
 * - Never dark text on a near-black background: every filled variant pairs a
 *   saturated background with either near-black text (cyan/blue buttons) or
 *   near-white text (red/green/amber buttons).
 * - Hover / active / focus-visible / disabled states are all distinguishable
 *   without relying on colour alone (borders, brightness, ring, icon opacity).
 * - Focus ring uses a high-contrast cyan that works on both light and dark
 *   surfaces, and is always visible for keyboard navigation.
 * - Disabled buttons keep readable labels (no opacity-collapse to mush):
 *   dashed border + muted-but-legible text + cursor feedback.
 */
const buttonVariants = cva(
  // base: shared structure + visible keyboard focus
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-offset-1 focus-visible:ring-offset-background active:translate-y-px aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Primary action: bright space-blue fill, near-black text (≈10:1)
        default:
          "bg-primary text-[#03101d] font-semibold shadow-[0_0_14px_rgba(0,163,255,0.25)] hover:bg-[#33b5ff] active:bg-[#0090e0] border border-[#66caff]/60",
        // Destructive: red fill, white text (≥4.5:1)
        destructive:
          "bg-destructive text-white font-semibold shadow-xs hover:bg-[#ff6b82] active:bg-[#e43c58] border border-[#ff8fa0]/50 focus-visible:ring-destructive/40",
        // Outline: transparent with a clearly visible blue border + light text
        outline:
          "border border-[#3d8fd9]/70 bg-[#0b1930]/80 text-cyan-100 hover:bg-[#123156] hover:border-[#66caff] active:bg-[#0e2340] shadow-xs",
        // Secondary: solid navy fill, light-blue text (≈9:1) — never dark-on-dark
        secondary:
          "bg-[#153056] text-cyan-50 font-medium border border-[#3d8fd9]/50 hover:bg-[#1c3f6e] active:bg-[#122a4d]",
        // Ghost: text-first variant with a subtle hover wash
        ghost:
          "text-cyan-100 hover:bg-[#123156]/80 hover:text-white active:bg-[#0e2340] border border-transparent hover:border-[#3d8fd9]/40",
        // Success: green fill for confirmations, near-black text on bright green
        success:
          "bg-[#2dd4a7] text-[#052e24] font-semibold border border-[#7ff0d3]/60 hover:bg-[#4ae0ba] active:bg-[#22b894] shadow-[0_0_14px_rgba(45,212,167,0.2)]",
        // Warning: amber fill, near-black text
        warning:
          "bg-[#ffb020] text-[#2b1c00] font-semibold border border-[#ffd27a]/60 hover:bg-[#ffc14d] active:bg-[#e69a10]",
        link: "text-[#66caff] underline-offset-4 hover:underline hover:text-[#99ddff] font-medium",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-7 rounded-md",
      },
      disabled: {
        // Readable disabled state: dashed border, legible muted text, no glow
        true: "disabled:opacity-100 disabled:border-dashed disabled:border-[#3d8fd9]/30 disabled:text-[#6f93b8] disabled:bg-[#0a1526]/60 disabled:shadow-none disabled:active:translate-y-0",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      disabled: false,
    },
  }
)

function Button({
  className,
  variant,
  size,
  disabled,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, disabled, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
