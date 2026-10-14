import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Native buttons previously inherited the unlayered reset; anchor children kept
// variant backgrounds. Variables preserve that distinction while caller utilities
// can still replace the low-specificity background and border declarations.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-[length:inherit] font-[inherit] leading-[inherit] text-inherit whitespace-nowrap transition-all border-[length:var(--button-border-width,0px)] bg-[color:var(--button-background,transparent)] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[var(--native-focus-color)] focus-visible:outline-offset-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "[&:not(button)]:[--button-background:var(--primary)] [&:not(button)]:hover:[--button-background:color-mix(in_oklab,var(--primary)_90%,transparent)]",
        destructive:
          "[&:not(button)]:[--button-background:var(--destructive)] [&:not(button)]:hover:[--button-background:color-mix(in_oklab,var(--destructive)_90%,transparent)] focus-visible:ring-destructive/20 dark:[&:not(button)]:[--button-background:color-mix(in_oklab,var(--destructive)_60%,transparent)] dark:focus-visible:ring-destructive/40",
        outline:
          "shadow-xs [&:not(button)]:[--button-border-width:1px] [&:not(button)]:[--button-background:var(--background)] [&:not(button)]:hover:[--button-background:var(--accent)] dark:[&:not(button)]:border-input dark:[&:not(button)]:[--button-background:color-mix(in_oklab,var(--input)_30%,transparent)] dark:[&:not(button)]:hover:[--button-background:color-mix(in_oklab,var(--input)_50%,transparent)]",
        secondary:
          "[&:not(button)]:[--button-background:var(--secondary)] [&:not(button)]:hover:[--button-background:color-mix(in_oklab,var(--secondary)_80%,transparent)]",
        ghost:
          "[&:not(button)]:hover:[--button-background:var(--accent)] dark:[&:not(button)]:hover:[--button-background:color-mix(in_oklab,var(--accent)_50%,transparent)]",
        link: "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
  const child = asChild && React.isValidElement<{ className?: string }>(props.children)
    ? props.children
    : null

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), child?.props.className, className)}
      {...props}
    >
      {child ? React.cloneElement(child, { className: undefined }) : props.children}
    </Comp>
  )
}

export { Button, buttonVariants }
