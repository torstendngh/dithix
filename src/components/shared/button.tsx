import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/tailwind-utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent font-mono text-xs whitespace-nowrap uppercase tracking-wide transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-zinc-600 bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-zinc-500 hover:bg-zinc-700",
        outline:
          "border-border bg-background text-foreground hover:bg-zinc-900 aria-expanded:bg-zinc-900 aria-pressed:border-zinc-500 aria-pressed:bg-zinc-800",
        secondary:
          "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 aria-expanded:bg-zinc-800",
        ghost:
          "text-zinc-400 hover:bg-zinc-900 hover:text-foreground aria-expanded:bg-zinc-900 aria-pressed:bg-zinc-800 aria-pressed:text-foreground",
        destructive:
          "border-red-900 bg-red-950/40 text-red-400 hover:bg-red-950 focus-visible:border-red-500",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-2 px-3",
        xs: "h-6 gap-1 px-2 text-2xs",
        sm: "h-7 gap-1.5 px-2.5",
        lg: "h-9 gap-2 px-4",
        icon: "size-8",
        "icon-xs": "size-6",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
