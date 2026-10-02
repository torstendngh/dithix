import { applyAdjustments } from "./adjust";
import { dither } from "./algorithms";
import { PaletteMatcher, paletteRgb } from "./color";
import { bayerMatrix, cachedMatrix, hashNoise, matrixThreshold } from "./matrices";
import type { DitherSettings, GradientSettings, PixelBuffer } from "./types";

/** Returns the source resampled to the given size (callers may cache). */
export type Resampler = (width: number, height: number) => PixelBuffer;

/** Position along the gradient for a pixel, 0..1, after applying the from/to range. */
export function gradientPosition(
  g: Pick<GradientSettings, "direction" | "from" | "to">,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const fx = width > 1 ? x / (width - 1) : 0;
  const fy = height > 1 ? y / (height - 1) : 0;
  let t: number;
  switch (g.direction) {
    case "left":
      t = 1 - fx;
      break;
    case "down":
      t = fy;
      break;
    case "up":
      t = 1 - fy;
      break;
    case "radial": {
      // Centre → farthest corner, normalised for the aspect ratio.
      const dx = fx - 0.5;
      const dy = fy - 0.5;
      t = Math.sqrt(dx * dx + dy * dy) / Math.SQRT1_2;
      break;
    }
    default:
      t = fx;
  }
  const span = g.to - g.from;
  if (span <= 0) return t >= g.from ? 1 : 0;
  return Math.min(1, Math.max(0, (t - g.from) / span));
}

/** Dot size for each band, linear from start to end. */
export function bandSizes(g: Pick<GradientSettings, "startSize" | "endSize" | "bands">): number[] {
  const n = Math.max(2, Math.round(g.bands));
  const a = Math.max(1, g.startSize);
  const b = Math.max(1, g.endSize);
  return Array.from({ length: n }, (_, i) => Math.max(1, Math.round(a + ((b - a) * i) / (n - 1))));
}

/**
 * Picks a band for every output pixel. Each dot's position along the gradient is jittered by
 * `scatter` so neighbouring bands interleave instead of meeting on a straight edge. Bands are
 * decided from the biggest dots down and a band claims whole dots, so large squares stay intact.
 * Returns the band index and the (jittered, clamped) gradient position of the pixel's dot.
 */
export function assignBands(
  g: GradientSettings,
  width: number,
  height: number,
): { band: Uint8Array; position: Float32Array } {
  const sizes = bandSizes(g);
  const n = sizes.length;
  const scatter = Math.max(0, g.scatter);
  // Bands a pixel can land in once jittered, either side of its own.
  const reach = Math.ceil((scatter / 2) * n) + 1;
  const band = new Uint8Array(width * height);
  const position = new Float32Array(width * height);

  /** Jittered gradient position of the band-k dot containing (x, y), sampled at the dot centre. */
  const dotPosition = (k: number, x: number, y: number) => {
    const size = sizes[k];
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const px = Math.min(width - 1, cx * size + (size - 1) / 2);
    const py = Math.min(height - 1, cy * size + (size - 1) / 2);
    const t = gradientPosition(g, px, py, width, height);
    return scatter > 0 ? t + (hashNoise(cx, cy, g.seed * 977 + k) - 0.5) * scatter : t;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const own = Math.min(n - 1, Math.floor(gradientPosition(g, x, y, width, height) * n));
      const lowest = Math.max(0, own - reach);
      let k = Math.min(n - 1, own + reach);
      let t = dotPosition(k, x, y);
      while (k > lowest && t * n < k) {
        k--;
        t = dotPosition(k, x, y);
      }
      const i = y * width + x;
      band[i] = k;
      position[i] = Math.min(1, Math.max(0, t));
    }
  }
  return { band, position };
}

interface BandLayer {
  size: number;
  width: number;
  dithered: PixelBuffer;
  original: PixelBuffer;
}

/**
 * Renders the gradient at width×height output pixels. Every distinct dot size is a full
 * adjust + dither pass at its own resolution; output pixels then pick their band's layer.
 */
export function ditherGradient(
  resample: Resampler,
  width: number,
  height: number,
  settings: Omit<DitherSettings, "resize">,
): PixelBuffer {
  const g = settings.gradient;
  const sizes = bandSizes(g);
  const matcher = new PaletteMatcher(paletteRgb(settings.palette.colors), settings.palette.distance);

  const layers = new Map<number, BandLayer>();
  for (const size of new Set(sizes)) {
    const w = Math.ceil(width / size);
    const h = Math.ceil(height / size);
    const original = applyAdjustments(resample(w, h), settings.adjust);
    layers.set(size, { size, width: w, original, dithered: dither(original, settings.dither, matcher) });
  }

  // Dissolve pattern for the fade, indexed per dot so it scales with the pixelation.
  const fade = matrixThreshold(cachedMatrix("bayer8", () => bayerMatrix(8)));
  const { band, position } = assignBands(g, width, height);
  const out = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const layer = layers.get(sizes[band[i]])!;
      const cx = Math.floor(x / layer.size);
      const cy = Math.floor(y / layer.size);
      const useOriginal = g.fadeIn && fade(cx, cy) >= position[i];
      const from = useOriginal ? layer.original : layer.dithered;
      const p = (cy * layer.width + cx) * 4;
      const o = i * 4;
      out[o] = from.data[p];
      out[o + 1] = from.data[p + 1];
      out[o + 2] = from.data[p + 2];
      out[o + 3] = from.data[p + 3];
    }
  }
  return { width, height, data: out };
}
