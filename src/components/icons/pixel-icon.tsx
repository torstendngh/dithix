import { cn } from "@/lib/tailwind-utils";
import { gridToRuns, ICONS, type IconName } from "./pixel-icons";

const PATHS = Object.fromEntries(
  Object.entries(ICONS).map(([name, grid]) => [
    name,
    {
      size: grid.length,
      d: gridToRuns(grid)
        .map(([x, y, w]) => `M${x} ${y}h${w}v1h-${w}z`)
        .join(""),
    },
  ]),
) as Record<IconName, { size: number; d: string }>;

interface PixelIconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  /** CSS pixels per icon pixel. */
  scale?: number;
}

function PixelIcon({ name, scale = 2, className, ...props }: PixelIconProps) {
  const { size, d } = PATHS[name];
  return (
    <svg
      data-slot="pixel-icon"
      viewBox={`0 0 ${size} ${size}`}
      width={size * scale}
      height={size * scale}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export { PixelIcon };
export type { IconName };
