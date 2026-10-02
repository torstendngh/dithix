"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { PixelIcon } from "@/components/icons/pixel-icon"
import { cn } from "@/lib/tailwind-utils"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-none border border-zinc-700 bg-zinc-950 transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-zinc-500 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <PixelIcon name="check" scale={1} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
