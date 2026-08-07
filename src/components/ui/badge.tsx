import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 transition-[color,box-shadow,border-color]",
  {
    variants: {
      variant: {
        default:
          "border-primary/15 bg-primary/10 text-primary [a&]:hover:bg-primary/14",
        secondary:
          "border-border/70 bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/88",
        destructive:
          "border-destructive/15 bg-[var(--status-danger-soft)] text-destructive [a&]:hover:bg-destructive/14 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/70 bg-card/60 text-foreground [a&]:hover:bg-accent/65 [a&]:hover:text-accent-foreground",
        ghost: "border-transparent text-soft [a&]:hover:bg-accent/70 [a&]:hover:text-accent-foreground",
        link: "border-transparent px-0 py-0 text-primary underline-offset-4 [a&]:hover:underline",
        success:
          "border-[color:var(--status-success)]/20 bg-[var(--status-success-soft)] text-[color:var(--status-success)]",
        warning:
          "border-[color:var(--status-warning)]/20 bg-[var(--status-warning-soft)] text-[color:var(--status-warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
