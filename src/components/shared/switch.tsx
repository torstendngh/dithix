"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/tailwind-utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-none border p-px transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive data-[size=default]:h-4 data-[size=default]:w-7 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:border-zinc-100 data-checked:bg-zinc-100 data-unchecked:border-zinc-700 data-unchecked:bg-zinc-950 data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-none transition-transform group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2.5 data-checked:translate-x-full data-checked:bg-zinc-950 data-unchecked:translate-x-0 data-unchecked:bg-zinc-500"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
