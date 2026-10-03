import { dither } from "./algorithms";
import { PaletteMatcher, paletteRgb } from "./color";
import { ditherGradient } from "./gradient";
import { prepareImage } from "./prepare";
import { computeOutputSize, resample } from "./resize";
import type { DitherSettings, PixelBuffer } from "./types";

export { paletteRgb };

/** Prepare (adjust, background, filters) + dither an image already at output resolution. */
export function ditherBuffer(src: PixelBuffer, settings: Omit<DitherSettings, "resize">): PixelBuffer {
  const adjusted = prepareImage(src, settings);
  const matcher = new PaletteMatcher(paletteRgb(settings.palette.colors), settings.palette.distance);
  return dither(adjusted, settings.dither, matcher);
}

/** Full pipeline: resize → prepare → dither (or the glitch gradient, when enabled). */
export function processImage(src: PixelBuffer, settings: DitherSettings): PixelBuffer {
  const { width, height } = computeOutputSize(src.width, src.height, settings.resize);
  if (settings.gradient.enabled) {
    return ditherGradient((w, h) => resample(src, w, h, settings.resize.filter), width, height, settings);
  }
  return ditherBuffer(resample(src, width, height, settings.resize.filter), settings);
}
