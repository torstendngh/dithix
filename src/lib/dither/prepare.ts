import { applyAdjustments } from "./adjust";
import { fillBackground } from "./background";
import { applyFilters, type FilterContext } from "./filters";
import type { DitherSettings, PixelBuffer } from "./types";

/**
 * Everything that happens to a resized image before it is dithered:
 * adjustments → background fill → filter stack.
 */
export function prepareImage(
  src: PixelBuffer,
  settings: Pick<DitherSettings, "adjust" | "background" | "filters">,
  ctx: FilterContext = { scale: 1 },
): PixelBuffer {
  const adjusted = applyAdjustments(src, settings.adjust);
  return applyFilters(fillBackground(adjusted, settings.background, ctx), settings.filters, ctx);
}
