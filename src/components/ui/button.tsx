import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold tracking-[-0.01em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_rgb(29_78_216_/_0.6)] hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[0_18px_34px_-18px_rgb(29_78_216_/_0.5)]",
        destructive:
          "bg-destructive text-white shadow-[0_14px_28px_-18px_rgb(220_38_38_/_0.45)] hover:-translate-y-0.5 hover:bg-destructive/92 focus-visible:ring-destructive/25 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/80 bg-card/90 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)] hover:-translate-y-0.5 hover:border-primary/20 hover:bg-accent/70 hover:text-accent-foreground dark:bg-card/70 dark:hover:bg-accent/60",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.45)] hover:bg-secondary/88",
        ghost:
          "text-muted-foreground hover:bg-accent/80 hover:text-foreground dark:hover:bg-accent/50",
        link: "rounded-none border-none px-0 text-primary underline-offset-4 hover:text-primary/80 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-[11px] has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-lg gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4.5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
