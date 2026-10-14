"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer box-border inline-flex size-[19px] shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] border-muted-foreground bg-background p-0 align-middle text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px] aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group/checkbox-indicator grid place-items-center [&_svg]:size-[14px]"
      >
        <CheckIcon data-slot="checkbox-check" className="group-data-[state=indeterminate]/checkbox-indicator:hidden" />
        <MinusIcon data-slot="checkbox-mixed" className="hidden group-data-[state=indeterminate]/checkbox-indicator:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
