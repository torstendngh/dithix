import type { ColorDistance, RGB } from "./types";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Safe on anything: stored data may hold non-strings. */
export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

export function hexToRgb(hex: string): RGB {
  const match = HEX_RE.exec(hex.trim());
  if (!match) throw new Error(`Invalid hex colour: ${hex}`);
  let h = match[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

type DistanceFn = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
) => number;

const distanceFns: Record<ColorDistance, DistanceFn> = {
  rgb: (r1, g1, b1, r2, g2, b2) => {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  },
  // "Redmean" low-cost perceptual approximation.
  redmean: (r1, g1, b1, r2, g2, b2) => {
    const rm = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
  },
  // Luma-first: brightness decides, hue only breaks ties.
  luma: (r1, g1, b1, r2, g2, b2) => {
    const dl = luma(r1, g1, b1) - luma(r2, g2, b2);
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dl * dl * 16 + (dr * dr + dg * dg + db * db) * 0.01;
  },
};

/**
 * Nearest-colour lookup with a per-instance cache keyed on the rounded RGB value.
 * Returns palette indices; the palette RGB values are available on `.colors`.
 */
export class PaletteMatcher {
  readonly colors: RGB[];
  private readonly flat: Float32Array;
  private readonly distance: DistanceFn;
  private readonly cache = new Map<number, number>();

  constructor(colors: RGB[], distance: ColorDistance = "rgb") {
    if (colors.length === 0) throw new Error("Palette must contain at least one colour");
    this.colors = colors;
    this.flat = new Float32Array(colors.flat());
    this.distance = distanceFns[distance];
  }

  nearest(r: number, g: number, b: number): number {
    const ri = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
    const gi = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
    const bi = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
    const key = (ri << 16) | (gi << 8) | bi;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const { flat, distance } = this;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0, p = 0; p < flat.length; i++, p += 3) {
      const d = distance(ri, gi, bi, flat[p], flat[p + 1], flat[p + 2]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (this.cache.size > 1 << 18) this.cache.clear();
    this.cache.set(key, best);
    return best;
  }

  /**
   * Per-channel offset that lets an ordered threshold span the gap between neighbouring
   * palette colours. For black/white this is exactly 255.
   */
  autoSpread(): number {
    const { colors } = this;
    if (colors.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < colors.length; i++) {
      let min = Infinity;
      for (let j = 0; j < colors.length; j++) {
        if (i === j) continue;
        const d = Math.sqrt(distanceFns.rgb(...colors[i], ...colors[j]));
        if (d > 0 && d < min) min = d;
      }
      if (min !== Infinity) total += min;
    }
    return total / colors.length / Math.sqrt(3);
  }
}

/** Parses palette hex strings, skipping invalid ones; falls back to black/white if none are valid. */
export function paletteRgb(colors: string[]): RGB[] {
  const valid = colors.filter(isHex).map(hexToRgb);
  return valid.length > 0 ? valid : [hexToRgb("#000000"), hexToRgb("#ffffff")];
}
