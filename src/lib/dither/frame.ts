import type { Resampler } from "./gradient";
import { computeOutputSize } from "./resize";
import type { CropRect, PixelBuffer, ResizeSettings } from "./types";

/**
 * Framing: which part of the source is used (crop) and how much transparent margin surrounds it
 * (background padding). The resize settings apply to the cropped region; the margin is added on
 * top, in output pixels.
 */

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
export const MAX_PADDING = 512;

/** Integer rectangle in source pixels. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameLayout {
  region: Region;
  /** Size of the image area (the resized region). */
  inner: { width: number; height: number };
  padding: number;
  /** Full output size, image plus margin on every side. */
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Crop rectangle → whole source pixels, always at least 1×1 and inside the image. */
export function cropRegion(srcWidth: number, srcHeight: number, crop: CropRect = FULL_CROP): Region {
  const x0 = clamp(Math.round(crop.x * srcWidth), 0, srcWidth - 1);
  const y0 = clamp(Math.round(crop.y * srcHeight), 0, srcHeight - 1);
  const x1 = clamp(Math.round((crop.x + crop.width) * srcWidth), x0 + 1, srcWidth);
  const y1 = clamp(Math.round((crop.y + crop.height) * srcHeight), y0 + 1, srcHeight);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function isFullRegion(region: Region, srcWidth: number, srcHeight: number): boolean {
  return region.x === 0 && region.y === 0 && region.width === srcWidth && region.height === srcHeight;
}

export function frameLayout(
  srcWidth: number,
  srcHeight: number,
  resize: ResizeSettings,
  crop: CropRect = FULL_CROP,
  padding = 0,
): FrameLayout {
  const region = cropRegion(srcWidth, srcHeight, crop);
  const inner = computeOutputSize(region.width, region.height, resize);
  const pad = clamp(Math.round(padding) || 0, 0, MAX_PADDING);
  return { region, inner, padding: pad, width: inner.width + 2 * pad, height: inner.height + 2 * pad };
}

/** Copies a region out of a buffer (returns the buffer itself when the region is all of it). */
export function extractRegion(src: PixelBuffer, region: Region): PixelBuffer {
  if (isFullRegion(region, src.width, src.height)) return src;
  const data = new Uint8ClampedArray(region.width * region.height * 4);
  for (let y = 0; y < region.height; y++) {
    const from = ((region.y + y) * src.width + region.x) * 4;
    data.set(src.data.subarray(from, from + region.width * 4), y * region.width * 4);
  }
  return { width: region.width, height: region.height, data };
}

/** Places an image on a transparent canvas of width×height at (left, top), clipping overflow. */
export function padBuffer(img: PixelBuffer, left: number, top: number, width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  const w = Math.min(img.width, width - left);
  for (let y = 0; y < Math.min(img.height, height - top); y++) {
    data.set(img.data.subarray(y * img.width * 4, (y * img.width + w) * 4), ((top + y) * width + left) * 4);
  }
  return { width, height, data };
}

/**
 * Turns "resize the cropped region to w×h" into "render the whole frame at w×h". The margin is
 * scaled with the requested size, so coarse glitch-gradient bands keep it in proportion.
 */
export function framedResampler(resizeRegion: Resampler, layout: FrameLayout): Resampler {
  if (layout.padding === 0) return resizeRegion;
  return (w, h) => {
    const px = Math.round((layout.padding * w) / layout.width);
    const py = Math.round((layout.padding * h) / layout.height);
    const iw = Math.max(1, w - 2 * px);
    const ih = Math.max(1, h - 2 * py);
    return padBuffer(resizeRegion(iw, ih), px, py, w, h);
  };
}
