import type { PixelBuffer, ResizeFilter, ResizeSettings } from "./types";

export const MAX_DIMENSION = 4096;

/** Output size for the dithering pass, preserving aspect ratio. */
export function computeOutputSize(
  srcWidth: number,
  srcHeight: number,
  resize: ResizeSettings,
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) return { width: 0, height: 0 };
  const aspect = srcWidth / srcHeight;
  let width: number;
  let height: number;
  switch (resize.mode) {
    case "width":
      width = resize.width;
      height = width / aspect;
      break;
    case "height":
      height = resize.height;
      width = height * aspect;
      break;
    default: {
      const s = resize.scale / 100;
      width = srcWidth * s;
      height = srcHeight * s;
    }
  }
  // Keep within limits without distorting the aspect ratio.
  const over = Math.max(width / MAX_DIMENSION, height / MAX_DIMENSION, 1);
  width /= over;
  height /= over;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

type Contribution = { start: number; weights: Float32Array };

/** Box-filter coverage weights for one axis. Works for down- and upscaling. */
function contributions(src: number, dst: number): Contribution[] {
  const ratio = src / dst;
  const out: Contribution[] = [];
  for (let i = 0; i < dst; i++) {
    const a = i * ratio;
    const b = Math.min(src, (i + 1) * ratio);
    const start = Math.floor(a);
    const end = Math.min(src, Math.ceil(b));
    const weights = new Float32Array(Math.max(1, end - start));
    let sum = 0;
    for (let j = start; j < end; j++) {
      const w = Math.min(b, j + 1) - Math.max(a, j);
      weights[j - start] = w;
      sum += w;
    }
    if (sum > 0) for (let k = 0; k < weights.length; k++) weights[k] /= sum;
    else weights[0] = 1;
    out.push({ start, weights });
  }
  return out;
}

/**
 * Bilinear resample sampling at pixel centres.
 * Sharper than area averaging when shrinking, at the cost of some aliasing.
 */
export function resampleBilinear(src: PixelBuffer, width: number, height: number): PixelBuffer {
  const { width: sw, height: sh, data: sd } = src;
  const out = new Uint8ClampedArray(width * height * 4);
  const fx = sw / width;
  const fy = sh / height;
  for (let y = 0; y < height; y++) {
    const syf = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(syf);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = syf - y0;
    for (let x = 0; x < width; x++) {
      const sxf = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(sxf);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = sxf - x0;
      const taps = [
        [(y0 * sw + x0) * 4, (1 - tx) * (1 - ty)],
        [(y0 * sw + x1) * 4, tx * (1 - ty)],
        [(y1 * sw + x0) * 4, (1 - tx) * ty],
        [(y1 * sw + x1) * 4, tx * ty],
      ];
      let r = 0, g = 0, b = 0, a = 0;
      for (const [p, w] of taps) {
        const al = sd[p + 3] * w;
        r += sd[p] * al;
        g += sd[p + 1] * al;
        b += sd[p + 2] * al;
        a += al;
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a;
    }
  }
  return { width, height, data: out };
}

/** Resample with the chosen filter (area averaging with premultiplied alpha by default). */
export function resample(
  src: PixelBuffer,
  width: number,
  height: number,
  filter: ResizeFilter = "area",
): PixelBuffer {
  if (src.width === width && src.height === height) {
    return { width, height, data: new Uint8ClampedArray(src.data) };
  }
  // "canvas" needs a browser canvas (see resampleCanvas); bilinear is the closest pure fallback.
  if (filter === "bilinear" || filter === "canvas") return resampleBilinear(src, width, height);
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;
  const cx = contributions(sw, width);
  const cy = contributions(sh, height);

  // Horizontal pass → premultiplied float buffer (width × sh).
  const tmp = new Float32Array(width * sh * 4);
  for (let y = 0; y < sh; y++) {
    const row = y * sw;
    for (let x = 0; x < width; x++) {
      const { start, weights } = cx[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < weights.length; k++) {
        const p = (row + start + k) * 4;
        const al = sd[p + 3] * weights[k];
        r += sd[p] * al;
        g += sd[p + 1] * al;
        b += sd[p + 2] * al;
        a += al;
      }
      const t = (y * width + x) * 4;
      tmp[t] = r;
      tmp[t + 1] = g;
      tmp[t + 2] = b;
      tmp[t + 3] = a;
    }
  }

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const { start, weights } = cy[y];
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < weights.length; k++) {
        const t = ((start + k) * width + x) * 4;
        const w = weights[k];
        r += tmp[t] * w;
        g += tmp[t + 1] * w;
        b += tmp[t + 2] * w;
        a += tmp[t + 3] * w;
      }
      const p = (y * width + x) * 4;
      if (a > 0) {
        out[p] = r / a;
        out[p + 1] = g / a;
        out[p + 2] = b / a;
      }
      out[p + 3] = a;
    }
  }
  return { width, height, data: out };
}

/**
 * Resize with the browser's own `drawImage` (default smoothing). Pass an ImageBitmap or image:
 * Chrome filters canvas sources differently, so those would not match other web tools.
 */
export function resampleCanvas(src: ImageBitmap, width: number, height: number): PixelBuffer {
  const to = new OffscreenCanvas(width, height);
  // No willReadFrequently: it forces a software canvas whose filtering differs from the default.
  const ctx = to.getContext("2d")!;
  ctx.drawImage(src, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data };
}
