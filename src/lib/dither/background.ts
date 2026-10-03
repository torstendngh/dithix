import { hexToRgb, isHex } from "./color";
import type { FilterContext } from "./filters";
import type { BackgroundMode, BackgroundSettings, PixelBuffer } from "./types";

export const BACKGROUND_MODES: { value: BackgroundMode; label: string }[] = [
  { value: "transparent", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "checker", label: "Checker" },
  { value: "stripes", label: "Stripes" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "gradient", label: "Gradient" },
];

/** True when pattern colour B is used (vs A) at output pixel (u, v). */
function patternB(mode: BackgroundMode, u: number, v: number, size: number): boolean {
  switch (mode) {
    case "checker":
      return (Math.floor(u / size) + Math.floor(v / size)) % 2 === 1;
    case "stripes":
      return Math.floor((u + v) / size) % 2 === 1;
    case "dots": {
      const cu = (u % size) - (size - 1) / 2;
      const cv = (v % size) - (size - 1) / 2;
      return cu * cu + cv * cv <= (size * 0.32) ** 2;
    }
    case "grid":
      return u % size === 0 || v % size === 0;
    default:
      return false;
  }
}

/**
 * Composites the image over the background so transparent areas get dithered with the rest.
 * Pattern coordinates are in output pixels, so it lines up in every glitch-gradient band.
 */
export function fillBackground(src: PixelBuffer, bg: BackgroundSettings, ctx: FilterContext = { scale: 1 }): PixelBuffer {
  if (bg.mode === "transparent") return src;
  const a = hexToRgb(isHex(bg.colorA) ? bg.colorA : "#000000");
  const b = hexToRgb(isHex(bg.colorB) ? bg.colorB : "#ffffff");
  const size = Math.max(1, Math.round(bg.size));
  const { width: w, height: h, data: d } = src;
  const out = new Uint8ClampedArray(d.length);

  for (let y = 0; y < h; y++) {
    const v = Math.floor(y / ctx.scale);
    const ty = h > 1 ? y / (h - 1) : 0;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r: number, g: number, bl: number;
      if (bg.mode === "gradient") {
        r = a[0] + (b[0] - a[0]) * ty;
        g = a[1] + (b[1] - a[1]) * ty;
        bl = a[2] + (b[2] - a[2]) * ty;
      } else {
        const c = patternB(bg.mode, Math.floor(x / ctx.scale), v, size) ? b : a;
        [r, g, bl] = c;
      }
      const alpha = d[o + 3] / 255;
      out[o] = d[o] * alpha + r * (1 - alpha);
      out[o + 1] = d[o + 1] * alpha + g * (1 - alpha);
      out[o + 2] = d[o + 2] * alpha + bl * (1 - alpha);
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}
