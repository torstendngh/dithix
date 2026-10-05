import { dither } from "./algorithms";
import { PaletteMatcher, paletteRgb } from "./color";
import { ditherGradient, gradientFromFilters } from "./gradient";
import { prepareImage } from "./prepare";
import { extractRegion, frameLayout, framedResampler, FULL_CROP } from "./frame";
import { resample } from "./resize";
import type { CropRect, DitherSettings, PixelBuffer } from "./types";

export { paletteRgb };

/** Prepare (adjust, background, filters) + dither an image already at output resolution. */
export function ditherBuffer(src: PixelBuffer, settings: Omit<DitherSettings, "resize">): PixelBuffer {
  const adjusted = prepareImage(src, settings);
  const matcher = new PaletteMatcher(paletteRgb(settings.palette.colors), settings.palette.distance);
  return dither(adjusted, settings.dither, matcher);
}

/**
 * Full pipeline: crop → resize → margin → prepare → dither (or the glitch gradient, when that
 * filter is on). `crop` belongs to the image rather than the look, so it is passed separately.
 */
export function processImage(src: PixelBuffer, settings: DitherSettings, crop: CropRect = FULL_CROP): PixelBuffer {
  const layout = frameLayout(src.width, src.height, settings.resize, crop, settings.background.padding);
  const region = extractRegion(src, layout.region);
  const frame = framedResampler((w, h) => resample(region, w, h, settings.resize.filter), layout);
  const gradient = gradientFromFilters(settings.filters);
  if (gradient) return ditherGradient(frame, layout.width, layout.height, settings, gradient);
  return ditherBuffer(frame(layout.width, layout.height), settings);
}
