import type { PixelBuffer } from "../types";

export function solid(width: number, height: number, rgba: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

/** Horizontal gradient from black to white. */
export function gradient(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round((x / (width - 1)) * 255);
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function uniqueColors(buf: PixelBuffer): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < buf.data.length; i += 4) {
    if (buf.data[i + 3] === 0) continue;
    set.add(`${buf.data[i]},${buf.data[i + 1]},${buf.data[i + 2]}`);
  }
  return set;
}

export function meanLuma(buf: PixelBuffer): number {
  let sum = 0;
  for (let i = 0; i < buf.data.length; i += 4) sum += buf.data[i];
  return sum / (buf.data.length / 4);
}
