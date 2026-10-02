import type { CurvePoint } from "./types";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Inserts a point keeping x-order. Returns the new array and the point's index, or -1 if the x is taken. */
export function insertCurvePoint(points: CurvePoint[], p: CurvePoint): { points: CurvePoint[]; index: number } {
  const x = Math.round(clamp(p.x, 0, 255));
  const y = Math.round(clamp(p.y, 0, 255));
  if (points.some((q) => q.x === x)) return { points, index: -1 };
  const next = [...points, { x, y }].sort((a, b) => a.x - b.x);
  return { points: next, index: next.findIndex((q) => q.x === x) };
}

/** Moves a point; x is kept strictly between its neighbours so ordering never changes. */
export function moveCurvePoint(points: CurvePoint[], index: number, x: number, y: number): CurvePoint[] {
  if (index < 0 || index >= points.length) return points;
  const minX = index > 0 ? points[index - 1].x + 1 : 0;
  const maxX = index < points.length - 1 ? points[index + 1].x - 1 : 255;
  const next = points.slice();
  next[index] = {
    x: Math.round(clamp(x, minX, maxX)),
    y: Math.round(clamp(y, 0, 255)),
  };
  return next;
}

/** Removes a point, always keeping at least two. */
export function removeCurvePoint(points: CurvePoint[], index: number): CurvePoint[] {
  if (points.length <= 2 || index < 0 || index >= points.length) return points;
  return points.filter((_, i) => i !== index);
}

/** Index of the closest point within `radius`, or -1. */
export function hitCurvePoint(points: CurvePoint[], x: number, y: number, radius: number): number {
  let best = -1;
  let bestD = radius * radius;
  points.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** 256-bin histogram for one channel (0..2) or luma (-1) of an RGBA buffer, ignoring transparent pixels. */
export function histogram(data: Uint8ClampedArray, channel: -1 | 0 | 1 | 2): Uint32Array {
  const bins = new Uint32Array(256);
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 128) continue;
    const v =
      channel === -1
        ? Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
        : data[p + channel];
    bins[v]++;
  }
  return bins;
}
