"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  thumbClassName,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
  thumbClassName?: string
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch box-border inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-input bg-input p-[2px] align-middle [transition:background_0.15s,border-color_0.15s] data-[size=sm]:h-[18px] data-[size=sm]:w-[30px] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px] aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={cn("pointer-events-none block size-4 shrink-0 rounded-full bg-primary-foreground [box-shadow:0_1px_3px_#233a2520] [transform:none] [translate:0] [transition:translate_0.15s] data-[state=checked]:[translate:16px] group-data-[size=sm]/switch:size-3 group-data-[size=sm]/switch:data-[state=checked]:[translate:12px] motion-reduce:transition-none", thumbClassName)} />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
