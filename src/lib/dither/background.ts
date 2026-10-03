import { hexToRgb, isHex } from "./color";
import type { FilterContext } from "./filters";
import { bayerMatrix, clusterMatrix, linesMatrix, type ThresholdMatrix } from "./matrices";
import type { BackgroundMode, BackgroundPattern, BackgroundSettings, PixelBuffer } from "./types";

export const BACKGROUND_MODES: { value: BackgroundMode; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "checker", label: "Checker" },
  { value: "stripes", label: "Stripes" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "gradient", label: "Gradient" },
  { value: "pattern", label: "Custom" },
];

// ── custom pattern ───────────────────────────────────────────────────────

export const PATTERN_SIZES = [2, 4, 8, 16];

/** Threshold matrices a pattern can be generated from, as a starting point for drawing. */
export const PATTERN_SOURCES: { id: string; label: string; build: () => ThresholdMatrix }[] = [
  { id: "bayer2", label: "Bayer 2×2", build: () => bayerMatrix(2) },
  { id: "bayer4", label: "Bayer 4×4", build: () => bayerMatrix(4) },
  { id: "bayer8", label: "Bayer 8×8", build: () => bayerMatrix(8) },
  { id: "bayer16", label: "Bayer 16×16", build: () => bayerMatrix(16) },
  { id: "cluster4", label: "Cluster 4×4", build: () => clusterMatrix(4) },
  { id: "cluster8", label: "Cluster 8×8", build: () => clusterMatrix(8) },
  { id: "lines-h", label: "Lines horizontal", build: () => linesMatrix("h", 8) },
  { id: "lines-v", label: "Lines vertical", build: () => linesMatrix("v", 8) },
  { id: "lines-d", label: "Lines diagonal", build: () => linesMatrix("d", 8) },
];

/**
 * The tile an ordered dither produces at one flat level: cells whose rank falls below
 * `density` (0..1) of the matrix are colour B. Keeps the caller's pixel scale.
 */
export function patternFromMatrix(m: ThresholdMatrix, density: number, scale = 1): BackgroundPattern {
  const on = Math.round(Math.min(1, Math.max(0, density)) * m.width * m.height);
  let cells = "";
  for (let i = 0; i < m.ranks.length; i++) cells += m.ranks[i] < on ? "1" : "0";
  return { size: m.width, cells, scale };
}

/** Changes the tile size, repeating the current tile so its pattern carries over. */
export function resizePattern(p: BackgroundPattern, size: number): BackgroundPattern {
  let cells = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) cells += p.cells[(y % p.size) * p.size + (x % p.size)];
  }
  return { ...p, size, cells };
}

export function defaultPattern(): BackgroundPattern {
  return patternFromMatrix(bayerMatrix(4), 0.5);
}

/** Validates a stored pattern; anything malformed falls back to the default tile. */
export function normalizePattern(raw: unknown): BackgroundPattern {
  const p = raw as Partial<BackgroundPattern> | null;
  const fallback = defaultPattern();
  if (!p || typeof p !== "object") return fallback;
  const scale = typeof p.scale === "number" && Number.isFinite(p.scale) ? Math.min(16, Math.max(1, Math.round(p.scale))) : 1;
  const size = p.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 2 || size > 16) return { ...fallback, scale };
  if (typeof p.cells !== "string" || p.cells.length !== size * size || /[^01]/.test(p.cells)) return { ...fallback, scale };
  return { size, cells: p.cells, scale };
}

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

function patternCell(p: BackgroundPattern, u: number, v: number): boolean {
  const x = Math.floor(u / p.scale) % p.size;
  const y = Math.floor(v / p.scale) % p.size;
  return p.cells.charCodeAt(y * p.size + x) === 49; // "1"
}

/**
 * Composites the image over the background so transparent areas get dithered with the rest.
 * Pattern coordinates are in output pixels, so it lines up in every glitch-gradient band.
 */
export function fillBackground(src: PixelBuffer, bg: BackgroundSettings, ctx: FilterContext = { scale: 1 }): PixelBuffer {
  if (!bg.enabled) return src;
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
        const u = Math.floor(x / ctx.scale);
        const useB = bg.mode === "pattern" ? patternCell(bg.pattern, u, v) : patternB(bg.mode, u, v, size);
        const c = useB ? b : a;
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
