import { rgbToHex } from "./color";
import type { PixelBuffer } from "./types";

/** Nearest-neighbour integer upscale. */
export function upscaleNearest(src: PixelBuffer, factor: number): PixelBuffer {
  const f = Math.max(1, Math.floor(factor));
  if (f === 1) return src;
  const width = src.width * f;
  const height = src.height * f;
  const out = new Uint8ClampedArray(width * height * 4);
  const s32 = new Uint32Array(src.data.buffer, src.data.byteOffset, src.width * src.height);
  const o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < height; y++) {
    const sy = ((y / f) | 0) * src.width;
    const row = y * width;
    for (let x = 0; x < width; x++) o32[row + x] = s32[sy + ((x / f) | 0)];
  }
  return { width, height, data: out };
}

/**
 * Vector export: one <path> per colour, built from horizontal runs so the file stays small.
 * Transparent pixels are left out.
 */
export function toSvg(src: PixelBuffer, scale = 1): string {
  const { width, height, data } = src;
  const paths = new Map<string, string[]>();
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const p = (y * width + x) * 4;
      if (data[p + 3] < 128) {
        x++;
        continue;
      }
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      let end = x + 1;
      while (end < width) {
        const q = (y * width + end) * 4;
        if (data[q + 3] < 128 || data[q] !== r || data[q + 1] !== g || data[q + 2] !== b) break;
        end++;
      }
      const hex = rgbToHex([r, g, b]);
      let list = paths.get(hex);
      if (!list) paths.set(hex, (list = []));
      list.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  }
  const body = [...paths]
    .map(([fill, d]) => `<path fill="${fill}" d="${d.join("")}"/>`)
    .join("\n");
  const s = Math.max(1, scale);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * s}" height="${height * s}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">\n${body}\n</svg>\n`
  );
}
