import { cn } from "@/lib/tailwind-utils";
import { gridToRuns, ICONS, type IconName } from "./pixel-icons";

const RUNS = Object.fromEntries(
  Object.entries(ICONS).map(([name, grid]) => [
    name,
    gridToRuns(grid)
      .map(([x, y, w]) => `M${x} ${y}h${w}v1h-${w}z`)
      .join(""),
  ]),
) as Record<IconName, string>;

interface PixelIconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  /** CSS pixels per icon pixel. */
  scale?: number;
}

function PixelIcon({ name, scale = 2, className, ...props }: PixelIconProps) {
  const size = 8 * scale;
  return (
    <svg
      data-slot="pixel-icon"
      viewBox="0 0 8 8"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d={RUNS[name]} fill="currentColor" />
    </svg>
  );
}

export { PixelIcon };
export type { IconName };
