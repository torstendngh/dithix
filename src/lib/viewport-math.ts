/** Pan/zoom maths for the image viewport. Offsets are in screen px from the viewport centre. */

export interface View {
  zoom: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 64;
export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const FIT_PADDING = 32;
/** How much of the image must stay on screen when panning. */
const KEEP_VISIBLE = 48;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Largest zoom that fits the image; snapped to whole multiples when enlarging so dots stay even. */
export function fitZoom(image: Size, viewport: Size): number {
  if (!image.width || !image.height || !viewport.width || !viewport.height) return 1;
  const z = Math.min(
    (viewport.width - FIT_PADDING * 2) / image.width,
    (viewport.height - FIT_PADDING * 2) / image.height,
  );
  return z >= 1 ? Math.floor(z) : clampZoom(z);
}

/** Keeps at least KEEP_VISIBLE px of the image inside the viewport. */
export function clampView(view: View, image: Size, viewport: Size): View {
  const limit = (img: number, vp: number) => Math.max(0, vp / 2 + (img * view.zoom) / 2 - KEEP_VISIBLE);
  const lx = limit(image.width, viewport.width);
  const ly = limit(image.height, viewport.height);
  return {
    zoom: view.zoom,
    x: Math.min(lx, Math.max(-lx, view.x)),
    y: Math.min(ly, Math.max(-ly, view.y)),
  };
}

/** Zooms so the image point under `anchor` (relative to viewport centre) stays put. */
export function zoomAround(view: View, zoom: number, anchor = { x: 0, y: 0 }): View {
  const z = clampZoom(zoom);
  const k = z / view.zoom;
  return {
    zoom: z,
    x: anchor.x - (anchor.x - view.x) * k,
    y: anchor.y - (anchor.y - view.y) * k,
  };
}

export function nextZoomStep(current: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? ZOOM_STEPS.find((z) => z > current + 1e-6)
      : [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-6);
  return next ?? (direction > 0 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[0]);
}

/** Wheel delta → multiplicative zoom factor. Pinch gestures arrive as ctrl+wheel with small deltas. */
export function wheelZoomFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-px * (pinch ? 0.01 : 0.002));
}
