import type { CropRect } from "@/lib/dither/types";

/** Interactive crop editing in normalised (0..1) source coordinates. */

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Smallest crop, as a fraction of each side. */
export const MIN_CROP = 0.02;

export const CROP_ASPECTS: { value: number; label: string }[] = [
  { value: 0, label: "Free" },
  { value: 1, label: "1:1" },
  { value: 4 / 3, label: "4:3" },
  { value: 3 / 2, label: "3:2" },
  { value: 16 / 9, label: "16:9" },
  { value: 9 / 16, label: "9:16" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pixel aspect (width / height) → the same shape in normalised coordinates of a w×h image. */
export const normalizedAspect = (aspect: number, srcWidth: number, srcHeight: number) =>
  aspect > 0 ? (aspect * srcHeight) / srcWidth : 0;

export function isFullCrop(r: CropRect): boolean {
  return r.x <= 1e-6 && r.y <= 1e-6 && r.width >= 1 - 1e-6 && r.height >= 1 - 1e-6;
}

/** Pans the crop window, keeping it inside the image. */
export function moveCrop(r: CropRect, dx: number, dy: number): CropRect {
  return {
    ...r,
    x: clamp(r.x + dx, 0, 1 - r.width),
    y: clamp(r.y + dy, 0, 1 - r.height),
  };
}

/**
 * Drags a handle by (dx, dy). With an aspect (normalised w/h, 0 = free) the opposite corner or
 * edge stays put and the shape is kept; the result always stays inside the image.
 */
export function resizeCrop(r: CropRect, handle: CropHandle, dx: number, dy: number, aspect = 0): CropRect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.width;
  let bottom = r.y + r.height;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN_CROP);
  if (handle.includes("e")) right = clamp(right + dx, left + MIN_CROP, 1);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN_CROP);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN_CROP, 1);
  if (aspect <= 0) return { x: left, y: top, width: right - left, height: bottom - top };

  // Keep the shape: let the dragged dimension lead, then fit into the room left from the anchor.
  const horizontal = handle === "e" || handle === "w";
  const vertical = handle === "n" || handle === "s";
  let w = right - left;
  let h = bottom - top;
  if (horizontal || (!vertical && Math.abs(dx) >= Math.abs(dy) * aspect)) h = w / aspect;
  else w = h * aspect;

  const anchorX = handle.includes("w") ? r.x + r.width : handle.includes("e") ? r.x : r.x + r.width / 2;
  const anchorY = handle.includes("n") ? r.y + r.height : handle.includes("s") ? r.y : r.y + r.height / 2;
  const roomX = handle.includes("w") ? anchorX : handle.includes("e") ? 1 - anchorX : 2 * Math.min(anchorX, 1 - anchorX);
  const roomY = handle.includes("n") ? anchorY : handle.includes("s") ? 1 - anchorY : 2 * Math.min(anchorY, 1 - anchorY);
  const fit = Math.min(1, roomX / w, roomY / h);
  w = Math.max(MIN_CROP, w * fit);
  h = Math.max(MIN_CROP, h * fit);

  const x = handle.includes("w") ? anchorX - w : handle.includes("e") ? anchorX : anchorX - w / 2;
  const y = handle.includes("n") ? anchorY - h : handle.includes("s") ? anchorY : anchorY - h / 2;
  return { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), width: w, height: h };
}

/** Largest crop with the given normalised aspect, centred on the current crop, inside the image. */
export function fitAspect(r: CropRect, aspect: number): CropRect {
  if (aspect <= 0) return r;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  let w = 1;
  let h = w / aspect;
  if (h > 1) {
    h = 1;
    w = aspect;
  }
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), width: w, height: h };
}
