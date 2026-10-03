import { hashNoise, mulberry32 } from "./matrices";
import type { FilterInstance, PixelBuffer } from "./types";

/**
 * Filter stack: image → image effects that run after adjustments and before dithering, so every
 * result still lands in the palette. Pixel-sized params are in output pixels and multiplied by
 * `ctx.scale`, which keeps them consistent when the glitch gradient renders at other resolutions.
 */

export interface FilterContext {
  /** Working pixels per output pixel (1 normally, <1 for coarse gradient bands). */
  scale: number;
}

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
  /** Shown multiplied, e.g. 100 for percentages stored as fractions. */
  display?: number;
  /** Discrete choices, rendered as a segmented control (as icons when given). */
  options?: { value: number; label: string; icon?: string }[];
}

export type FilterCategory = "basic" | "stylize" | "warp" | "glitch";

export interface FilterDef {
  type: string;
  name: string;
  category: FilterCategory;
  description: string;
  params: ParamDef[];
  /** At most one instance in the stack. */
  unique?: boolean;
  /**
   * Changes how the stack is dithered instead of editing pixels: `apply` is a no-op and the
   * pipeline reads the params (see `gradientFromFilters`). Position in the stack doesn't matter.
   */
  render?: boolean;
  apply: (src: PixelBuffer, p: Record<string, number>, ctx: FilterContext) => PixelBuffer;
}

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "stylize", label: "Stylize" },
  { id: "warp", label: "Warp" },
  { id: "glitch", label: "Glitch · experimental" },
];

export const MAX_FILTERS = 24;

// ── helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clone = (src: PixelBuffer): PixelBuffer => ({ width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) });
const luma = (d: Uint8ClampedArray, p: number) => 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];

/** Bilinear sample with clamped edges, written to out[o..o+3]. */
function sample(src: PixelBuffer, fx: number, fy: number, out: Uint8ClampedArray, o: number) {
  const { width: w, height: h, data: d } = src;
  const x = clamp(fx, 0, w - 1);
  const y = clamp(fy, 0, h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = (y0 * w + x0) * 4;
  const b = (y0 * w + x1) * 4;
  const c = (y1 * w + x0) * 4;
  const e = (y1 * w + x1) * 4;
  for (let k = 0; k < 4; k++) {
    const top = d[a + k] + (d[b + k] - d[a + k]) * tx;
    const bottom = d[c + k] + (d[e + k] - d[c + k]) * tx;
    out[o + k] = top + (bottom - top) * ty;
  }
}

/** Inverse-mapped warp: for each output pixel, where to read from. */
function warp(src: PixelBuffer, map: (x: number, y: number) => [number, number]): PixelBuffer {
  const out = new Uint8ClampedArray(src.data.length);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const [sx, sy] = map(x, y);
      sample(src, sx, sy, out, (y * src.width + x) * 4);
    }
  }
  return { width: src.width, height: src.height, data: out };
}

/** Separable box blur, run twice for a smooth, near-Gaussian falloff. */
export function boxBlur(src: PixelBuffer, radius: number): PixelBuffer {
  const r = Math.round(radius);
  if (r < 1) return clone(src);
  const { width: w, height: h } = src;
  let cur = new Float32Array(src.data);
  const tmp = new Float32Array(cur.length);
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const lines = horizontal ? h : w;
    const len = horizontal ? w : h;
    const stride = horizontal ? 4 : w * 4;
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 4 : l * 4;
      for (let k = 0; k < 4; k++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) acc += from[base + clamp(i, 0, len - 1) * stride + k];
        for (let i = 0; i < len; i++) {
          to[base + i * stride + k] = acc / (2 * r + 1);
          acc += from[base + clamp(i + r + 1, 0, len - 1) * stride + k] - from[base + clamp(i - r, 0, len - 1) * stride + k];
        }
      }
    }
  };
  for (let n = 0; n < 2; n++) {
    pass(cur, tmp, true);
    pass(tmp, cur, false);
  }
  return { width: w, height: h, data: new Uint8ClampedArray(cur) };
}

const DIRECTION = [
  { value: 0, label: "Horizontal" },
  { value: 1, label: "Vertical" },
];

/** Glitch gradient directions, indexed like `GRADIENT_DIRECTIONS` in gradient.ts. */
const GRADIENT_DIRECTION = [
  { value: 0, label: "Left to right", icon: "arrow-right" },
  { value: 1, label: "Right to left", icon: "arrow-left" },
  { value: 2, label: "Top to bottom", icon: "arrow-down" },
  { value: 3, label: "Bottom to top", icon: "arrow-up" },
  { value: 4, label: "Centre outwards", icon: "radial" },
];

export const GLITCH_GRADIENT = "glitch-gradient";

// ── registry ─────────────────────────────────────────────────────────────

export const FILTERS: FilterDef[] = [
  {
    type: "blur",
    name: "Blur",
    category: "basic",
    description: "Soften detail before dithering.",
    params: [{ key: "radius", label: "Radius", min: 0, max: 20, step: 0.5, default: 2, unit: "px" }],
    apply: (src, p, ctx) => boxBlur(src, p.radius * ctx.scale),
  },
  {
    type: "sharpen",
    name: "Sharpen",
    category: "basic",
    description: "Unsharp mask: crisper edges survive the dither better.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 3, step: 0.05, default: 1, display: 100, unit: "%" },
      { key: "radius", label: "Radius", min: 0.5, max: 6, step: 0.5, default: 1, unit: "px" },
    ],
    apply: (src, p, ctx) => {
      const blurred = boxBlur(src, Math.max(1, p.radius * ctx.scale));
      const out = clone(src);
      for (let i = 0; i < out.data.length; i += 4) {
        for (let k = 0; k < 3; k++) out.data[i + k] = src.data[i + k] + (src.data[i + k] - blurred.data[i + k]) * p.amount;
      }
      return out;
    },
  },
  {
    type: "posterize",
    name: "Posterize",
    category: "basic",
    description: "Flatten each channel to a few levels.",
    params: [{ key: "levels", label: "Levels", min: 2, max: 16, step: 1, default: 4 }],
    apply: (src, p) => {
      const out = clone(src);
      const n = Math.max(2, Math.round(p.levels)) - 1;
      for (let i = 0; i < out.data.length; i += 4) {
        for (let k = 0; k < 3; k++) out.data[i + k] = (Math.round((out.data[i + k] / 255) * n) / n) * 255;
      }
      return out;
    },
  },
  {
    type: "grain",
    name: "Grain",
    category: "basic",
    description: "Film-like noise, sized to output pixels.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 100, step: 1, default: 25, unit: "%" },
      { key: "seed", label: "Seed", min: 0, max: 9999, step: 1, default: 1 },
    ],
    apply: (src, p, ctx) => {
      const out = clone(src);
      const strength = (p.amount / 100) * 160;
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          const n = (hashNoise(Math.floor(x / ctx.scale), Math.floor(y / ctx.scale), p.seed) - 0.5) * strength;
          const o = (y * src.width + x) * 4;
          for (let k = 0; k < 3; k++) out.data[o + k] = src.data[o + k] + n;
        }
      }
      return out;
    },
  },
  {
    type: "vignette",
    name: "Vignette",
    category: "basic",
    description: "Darken towards the edges.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 100, step: 1, default: 60, unit: "%" },
      { key: "size", label: "Size", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
    apply: (src, p) => {
      const out = clone(src);
      const { width: w, height: h } = src;
      const start = (p.size / 100) * 0.7;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x + 0.5) / w - 0.5;
          const dy = (y + 0.5) / h - 0.5;
          const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT1_2;
          const t = clamp((d - start) / Math.max(0.0001, 1 - start), 0, 1);
          const f = 1 - (p.amount / 100) * t * t * (3 - 2 * t);
          const o = (y * w + x) * 4;
          for (let k = 0; k < 3; k++) out.data[o + k] = src.data[o + k] * f;
        }
      }
      return out;
    },
  },
  {
    type: "edges",
    name: "Edge detect",
    category: "stylize",
    description: "Sobel edges, inked over the image or on their own.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 100, step: 1, default: 70, unit: "%" },
      { key: "mode", label: "Mode", min: 0, max: 1, default: 0, options: [{ value: 0, label: "Ink" }, { value: 1, label: "Neon" }] },
    ],
    apply: (src, p) => {
      const { width: w, height: h, data: d } = src;
      const out = clone(src);
      const L = (x: number, y: number) => luma(d, (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4);
      const amt = p.amount / 100;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx = -L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1) + L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1);
          const gy = -L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1) + L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1);
          const e = clamp(Math.sqrt(gx * gx + gy * gy) / 4, 0, 255);
          const o = (y * w + x) * 4;
          for (let k = 0; k < 3; k++) {
            const target = p.mode === 1 ? (d[o + k] * e) / 255 + e * 0.6 : d[o + k] * (1 - e / 255);
            out.data[o + k] = d[o + k] + (target - d[o + k]) * amt;
          }
        }
      }
      return out;
    },
  },
  {
    type: "glow",
    name: "Glow",
    category: "stylize",
    description: "Bloom around bright areas.",
    params: [
      { key: "threshold", label: "Threshold", min: 0, max: 255, step: 1, default: 150 },
      { key: "radius", label: "Radius", min: 1, max: 40, step: 1, default: 8, unit: "px" },
      { key: "strength", label: "Strength", min: 0, max: 3, step: 0.05, default: 1.2, display: 100, unit: "%" },
    ],
    apply: (src, p, ctx) => {
      const bright = clone(src);
      for (let i = 0; i < bright.data.length; i += 4) {
        const f = clamp((luma(src.data, i) - p.threshold) / Math.max(1, 255 - p.threshold), 0, 1);
        for (let k = 0; k < 3; k++) bright.data[i + k] = src.data[i + k] * f;
      }
      const halo = boxBlur(bright, Math.max(1, p.radius * ctx.scale));
      const out = clone(src);
      for (let i = 0; i < out.data.length; i += 4) {
        for (let k = 0; k < 3; k++) out.data[i + k] = src.data[i + k] + halo.data[i + k] * p.strength;
      }
      return out;
    },
  },
  {
    type: "scanlines",
    name: "Scanlines",
    category: "stylize",
    description: "CRT-style dark lines.",
    params: [
      { key: "spacing", label: "Spacing", min: 2, max: 24, step: 1, default: 4, unit: "px" },
      { key: "thickness", label: "Thickness", min: 1, max: 12, step: 1, default: 1, unit: "px" },
      { key: "darkness", label: "Darkness", min: 0, max: 100, step: 1, default: 60, unit: "%" },
      { key: "direction", label: "Direction", min: 0, max: 1, default: 0, options: DIRECTION },
    ],
    apply: (src, p, ctx) => {
      const out = clone(src);
      const spacing = Math.max(1, p.spacing);
      const f = 1 - p.darkness / 100;
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          const pos = Math.floor((p.direction === 1 ? x : y) / ctx.scale);
          if (pos % spacing >= Math.min(p.thickness, spacing)) continue;
          const o = (y * src.width + x) * 4;
          for (let k = 0; k < 3; k++) out.data[o + k] = src.data[o + k] * f;
        }
      }
      return out;
    },
  },
  {
    type: "wave",
    name: "Wave",
    category: "warp",
    description: "Ripple the image along a sine wave.",
    params: [
      { key: "amplitude", label: "Amplitude", min: 0, max: 100, step: 1, default: 12, unit: "px" },
      { key: "wavelength", label: "Wavelength", min: 4, max: 400, step: 1, default: 60, unit: "px" },
      { key: "phase", label: "Phase", min: 0, max: 360, step: 1, default: 0, unit: "°" },
      { key: "direction", label: "Direction", min: 0, max: 1, default: 0, options: DIRECTION },
    ],
    apply: (src, p, ctx) => {
      const amp = p.amplitude * ctx.scale;
      const k = (2 * Math.PI) / Math.max(1, p.wavelength * ctx.scale);
      const ph = (p.phase * Math.PI) / 180;
      return p.direction === 1
        ? warp(src, (x, y) => [x, y + Math.sin(x * k + ph) * amp])
        : warp(src, (x, y) => [x + Math.sin(y * k + ph) * amp, y]);
    },
  },
  {
    type: "swirl",
    name: "Swirl",
    category: "warp",
    description: "Twist around the centre.",
    params: [
      { key: "angle", label: "Angle", min: -720, max: 720, step: 5, default: 180, unit: "°" },
      { key: "radius", label: "Radius", min: 5, max: 100, step: 1, default: 60, unit: "%" },
    ],
    apply: (src, p) => {
      const cx = src.width / 2;
      const cy = src.height / 2;
      const R = (Math.min(src.width, src.height) / 2) * (p.radius / 50);
      const a = (p.angle * Math.PI) / 180;
      return warp(src, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R) return [x, y];
        const t = 1 - d / R;
        const th = Math.atan2(dy, dx) + a * t * t;
        return [cx + Math.cos(th) * d, cy + Math.sin(th) * d];
      });
    },
  },
  {
    type: "bulge",
    name: "Bulge / pinch",
    category: "warp",
    description: "Push the centre out or pull it in.",
    params: [
      { key: "strength", label: "Strength", min: -100, max: 100, step: 1, default: 50, unit: "%" },
      { key: "radius", label: "Radius", min: 5, max: 100, step: 1, default: 60, unit: "%" },
    ],
    apply: (src, p) => {
      const cx = src.width / 2;
      const cy = src.height / 2;
      const R = (Math.min(src.width, src.height) / 2) * (p.radius / 50);
      const s = p.strength / 100;
      return warp(src, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R || d === 0) return [x, y];
        const r = d / R;
        // s > 0 magnifies the centre (bulge), s < 0 shrinks it (pinch).
        const f = Math.pow(r, s >= 0 ? 1 + s : 1 / (1 - s)) / r;
        return [cx + dx * f, cy + dy * f];
      });
    },
  },
  {
    type: "luma-displace",
    name: "Luma displace",
    category: "warp",
    description: "Shift pixels by their brightness — bends lines into flowing contours.",
    params: [
      { key: "amount", label: "Amount", min: -100, max: 100, step: 1, default: 30, unit: "px" },
      { key: "direction", label: "Direction", min: 0, max: 1, default: 1, options: DIRECTION },
      { key: "smooth", label: "Smooth", min: 0, max: 10, step: 0.5, default: 2, unit: "px" },
    ],
    apply: (src, p, ctx) => {
      const map = p.smooth > 0 ? boxBlur(src, p.smooth * ctx.scale) : src;
      const amt = p.amount * ctx.scale;
      return warp(src, (x, y) => {
        const l = luma(map.data, (y * src.width + x) * 4) / 255 - 0.5;
        return p.direction === 1 ? [x, y + l * amt] : [x + l * amt, y];
      });
    },
  },
  {
    type: "rgb-split",
    name: "RGB split",
    category: "glitch",
    description: "Pull the red and blue channels apart.",
    params: [
      { key: "offset", label: "Offset", min: 0, max: 50, step: 1, default: 6, unit: "px" },
      { key: "angle", label: "Angle", min: 0, max: 360, step: 5, default: 0, unit: "°" },
    ],
    apply: (src, p, ctx) => {
      const out = clone(src);
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(a) * p.offset * ctx.scale);
      const dy = Math.round(Math.sin(a) * p.offset * ctx.scale);
      const { width: w, height: h, data: d } = src;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          out.data[o] = d[(clamp(y - dy, 0, h - 1) * w + clamp(x - dx, 0, w - 1)) * 4];
          out.data[o + 2] = d[(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4 + 2];
        }
      }
      return out;
    },
  },
  {
    type: "pixel-sort",
    name: "Pixel sort",
    category: "glitch",
    description: "Sort runs of pixels in a brightness range into streaks.",
    params: [
      { key: "direction", label: "Direction", min: 0, max: 1, default: 1, options: DIRECTION },
      { key: "low", label: "From", min: 0, max: 255, step: 1, default: 60 },
      { key: "high", label: "To", min: 0, max: 255, step: 1, default: 230 },
      { key: "reverse", label: "Order", min: 0, max: 1, default: 0, options: [{ value: 0, label: "Dark → light" }, { value: 1, label: "Light → dark" }] },
    ],
    apply: (src, p) => sortPixels(src, p.direction === 1, Math.min(p.low, p.high), Math.max(p.low, p.high), p.reverse === 1),
  },
  {
    type: "slice-shift",
    name: "Slice shift",
    category: "glitch",
    description: "Tear the image into bands and slide them sideways.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 100, step: 1, default: 15, unit: "%" },
      { key: "slices", label: "Slices", min: 2, max: 64, step: 1, default: 18 },
      { key: "seed", label: "Seed", min: 0, max: 9999, step: 1, default: 1 },
    ],
    apply: (src, p) => {
      const { width: w, height: h, data: d } = src;
      const out = clone(src);
      const rand = mulberry32(Math.round(p.seed) * 7919 + 1);
      // Random band edges in relative coordinates, so the tear matches at any resolution.
      const n = Math.max(2, Math.round(p.slices));
      const cuts = Array.from({ length: n - 1 }, () => rand()).sort((a, b) => a - b);
      const edges = [0, ...cuts, 1];
      const offsets = edges.slice(1).map(() => (rand() < 0.45 ? 0 : (rand() * 2 - 1) * (p.amount / 100)));
      for (let y = 0; y < h; y++) {
        const t = (y + 0.5) / h;
        let band = 0;
        while (band < offsets.length - 1 && t >= edges[band + 1]) band++;
        const shift = Math.round(offsets[band] * w);
        if (shift === 0) continue;
        for (let x = 0; x < w; x++) {
          const sx = (((x - shift) % w) + w) % w;
          out.data.set(d.subarray((y * w + sx) * 4, (y * w + sx) * 4 + 4), (y * w + x) * 4);
        }
      }
      return out;
    },
  },
  {
    type: "block-glitch",
    name: "Block glitch",
    category: "glitch",
    description: "Corrupted macroblocks: displaced, channel-swapped tiles.",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 100, step: 1, default: 20, unit: "%" },
      { key: "size", label: "Block", min: 2, max: 64, step: 1, default: 12, unit: "px" },
      { key: "seed", label: "Seed", min: 0, max: 9999, step: 1, default: 1 },
    ],
    apply: (src, p, ctx) => {
      const { width: w, height: h, data: d } = src;
      const out = clone(src);
      const size = Math.max(1, Math.round(p.size * ctx.scale));
      const bw = Math.ceil(w / size);
      const bh = Math.ceil(h / size);
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          // Decide per block in relative coordinates so it matches across resolutions.
          const key = hashNoise(Math.floor((bx / bw) * 4096), Math.floor((by / bh) * 4096), p.seed);
          if (key >= p.amount / 100) continue;
          const r = hashNoise(bx, by, p.seed + 31);
          const sx = Math.floor(r * bw) * size;
          const sy = Math.floor(hashNoise(by, bx, p.seed + 77) * bh) * size;
          const swap = Math.floor(hashNoise(bx, by, p.seed + 5) * 3);
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const tx = bx * size + x;
              const ty = by * size + y;
              if (tx >= w || ty >= h) continue;
              const s = (clamp(sy + y, 0, h - 1) * w + clamp(sx + x, 0, w - 1)) * 4;
              const o = (ty * w + tx) * 4;
              out.data[o] = d[s + ((0 + swap) % 3)];
              out.data[o + 1] = d[s + ((1 + swap) % 3)];
              out.data[o + 2] = d[s + ((2 + swap) % 3)];
            }
          }
        }
      }
      return out;
    },
  },
  {
    type: "tv-glitch",
    name: "TV glitch",
    category: "glitch",
    description: "Bad analog signal: wobbling lines, a VHS tracking band, colour bleed and static.",
    params: [
      { key: "wobble", label: "Wobble", min: 0, max: 100, step: 1, default: 35, unit: "%" },
      { key: "tracking", label: "Tracking", min: 0, max: 100, step: 1, default: 50, unit: "%" },
      { key: "position", label: "Band at", min: 0, max: 100, step: 1, default: 70, unit: "%" },
      { key: "chroma", label: "Colour bleed", min: 0, max: 30, step: 1, default: 5, unit: "px" },
      { key: "noise", label: "Static", min: 0, max: 100, step: 1, default: 25, unit: "%" },
      { key: "seed", label: "Seed", min: 0, max: 9999, step: 1, default: 1 },
    ],
    apply: (src, p, ctx) => tvGlitch(src, p, ctx),
  },
  {
    type: GLITCH_GRADIENT,
    name: "Glitch gradient",
    category: "glitch",
    description: "Dither in bands whose dots grow from start to end size. Applies to the whole stack.",
    unique: true,
    render: true,
    params: [
      { key: "direction", label: "Direction", min: 0, max: 4, default: 0, options: GRADIENT_DIRECTION },
      { key: "startSize", label: "Start dot", min: 1, max: 32, step: 1, default: 1, unit: "px" },
      { key: "endSize", label: "End dot", min: 1, max: 32, step: 1, default: 8, unit: "px" },
      { key: "bands", label: "Bands", min: 2, max: 24, step: 1, default: 6 },
      { key: "scatter", label: "Scatter", min: 0, max: 1, step: 0.01, default: 0.35, display: 100, unit: "%" },
      { key: "seed", label: "Seed", min: 0, max: 99999, step: 1, default: 1 },
      { key: "from", label: "From", min: 0, max: 1, step: 0.01, default: 0, display: 100, unit: "%" },
      { key: "to", label: "To", min: 0, max: 1, step: 0.01, default: 1, display: 100, unit: "%" },
      { key: "fadeIn", label: "Fade from original", min: 0, max: 1, default: 0, options: [{ value: 0, label: "Off" }, { value: 1, label: "On" }] },
    ],
    apply: (src) => src,
  },
];

/**
 * Analog TV / VHS breakdown. Every scanline is shifted by a slow sync wobble plus random jitter
 * and the odd hard tear; a tracking band rips lines much further and fills with static. Colour is
 * split from brightness and smeared sideways, the way composite video bleeds. Rows are keyed in
 * output pixels (`ctx.scale`) and the band in relative height, so it matches across resolutions.
 */
export function tvGlitch(src: PixelBuffer, p: Record<string, number>, ctx: FilterContext): PixelBuffer {
  const { width: w, height: h, data: d } = src;
  const out = new Uint8ClampedArray(d.length);
  const s = ctx.scale;
  const seed = Math.round(p.seed);
  const wobble = p.wobble / 100;
  const tracking = p.tracking / 100;
  const noise = p.noise / 100;
  const bleed = Math.max(0, Math.round(p.chroma * s));
  const bandCentre = p.position / 100;
  const bandHalf = 0.04 + tracking * 0.06;
  const phase = hashNoise(seed, 0, 911) * Math.PI * 2;

  const lumaRow = new Float32Array(w);
  const uRow = new Float32Array(w);
  const vRow = new Float32Array(w);
  const alphaRow = new Float32Array(w);

  for (let y = 0; y < h; y++) {
    const line = Math.floor(y / s);
    const t = (y + 0.5) / h;

    // Horizontal sync: a slow wave, per-line jitter and occasional hard tears.
    let shift = Math.sin(t * 9 + phase) * 6 + Math.sin(t * 37 + phase * 2) * 2;
    shift += (hashNoise(line, 0, seed) - 0.5) * 6;
    if (hashNoise(Math.floor(line / 3), 1, seed) < wobble * 0.06) shift += (hashNoise(line, 2, seed) - 0.5) * 120;
    shift *= wobble;

    // Tracking band: lines drag sideways the closer they are to its centre.
    const inBand = Math.max(0, 1 - Math.abs(t - bandCentre) / bandHalf) * tracking;
    shift += inBand * inBand * (0.5 + hashNoise(line, 3, seed)) * 0.3 * (w / s);
    const px = Math.round(shift * s);

    // Shifted line, split into brightness and colour (YUV-ish). Off the edge is blanking (black).
    for (let x = 0; x < w; x++) {
      const sx = x - px;
      if (sx < 0 || sx >= w) {
        lumaRow[x] = uRow[x] = vRow[x] = 0;
        alphaRow[x] = 255;
        continue;
      }
      const o = (y * w + sx) * 4;
      const l = luma(d, o);
      lumaRow[x] = l;
      uRow[x] = d[o + 2] - l;
      vRow[x] = d[o] - l;
      alphaRow[x] = d[o + 3];
    }

    // Static: snow everywhere, much more inside the band, and white dropout streaks.
    const snow = noise * 90 + inBand * 160;
    const dropout = hashNoise(line, 4, seed) < noise * 0.04 + inBand * 0.25;
    const dropStart = hashNoise(line, 5, seed) * w;
    const dropLen = (0.05 + hashNoise(line, 6, seed) * 0.4) * w;

    for (let x = 0; x < w; x++) {
      // Colour is lower resolution than brightness: average it over the bleed and lag it behind.
      let u = 0;
      let v = 0;
      if (bleed > 0) {
        let n = 0;
        for (let k = x - bleed * 2; k <= x; k++) {
          const c = clamp(k, 0, w - 1);
          u += uRow[c];
          v += vRow[c];
          n++;
        }
        u /= n;
        v /= n;
      } else {
        u = uRow[x];
        v = vRow[x];
      }
      let l = lumaRow[x];
      if (snow > 0) l += (hashNoise(Math.floor(x / s), line, seed + 17) - 0.5) * snow;
      if (dropout && x >= dropStart && x < dropStart + dropLen) l = 235 + hashNoise(x, line, seed + 3) * 20;
      const o = (y * w + x) * 4;
      // Back from YUV-ish: r = l + v, b = l + u, g from the luma weights.
      const r = l + v;
      const b = l + u;
      out[o] = r;
      out[o + 1] = (l - 0.299 * r - 0.114 * b) / 0.587;
      out[o + 2] = b;
      out[o + 3] = alphaRow[x];
    }
  }
  return { width: w, height: h, data: out };
}

/** Sorts each run of pixels whose brightness is within [low, high], along rows or columns. */
export function sortPixels(src: PixelBuffer, vertical: boolean, low: number, high: number, reverse: boolean): PixelBuffer {
  const { width: w, height: h, data: d } = src;
  const out = clone(src);
  const lines = vertical ? w : h;
  const len = vertical ? h : w;
  const index = (line: number, i: number) => (vertical ? i * w + line : line * w + i) * 4;
  const run: { l: number; p: number }[] = [];
  const flush = (line: number, end: number) => {
    if (run.length > 1) {
      const sorted = [...run].sort((a, b) => (reverse ? b.l - a.l : a.l - b.l));
      const start = end - run.length;
      sorted.forEach((r, k) => out.data.set(d.subarray(r.p, r.p + 4), index(line, start + k)));
    }
    run.length = 0;
  };
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) {
      const p = index(line, i);
      const l = luma(d, p);
      if (l >= low && l <= high) run.push({ l, p });
      else flush(line, i);
    }
    flush(line, len);
  }
  return out;
}

export function getFilter(type: string): FilterDef | undefined {
  return FILTERS.find((f) => f.type === type);
}

export function defaultParams(def: FilterDef): Record<string, number> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

/** Runs the enabled pixel filters in order (render filters are read by the pipeline instead). */
export function applyFilters(src: PixelBuffer, filters: FilterInstance[], ctx: FilterContext = { scale: 1 }): PixelBuffer {
  let img = src;
  for (const f of filters) {
    if (!f.enabled) continue;
    const def = getFilter(f.type);
    if (def && !def.render) img = def.apply(img, f.params, ctx);
  }
  return img;
}

/**
 * Validates a filter list from storage, presets or imports: unknown types are dropped, params
 * are clamped to their ranges and missing ones get defaults.
 */
export function normalizeFilters(raw: unknown): FilterInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: FilterInstance[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Partial<FilterInstance>;
    const def = typeof f.type === "string" ? getFilter(f.type) : undefined;
    if (!def || (def.unique && out.some((x) => x.type === def.type))) continue;
    const params: Record<string, number> = {};
    for (const p of def.params) {
      const v = f.params?.[p.key];
      params[p.key] = typeof v === "number" && Number.isFinite(v) ? clamp(v, p.min, p.max) : p.default;
    }
    out.push({
      id: typeof f.id === "string" && f.id ? f.id : `${def.type}-${out.length}`,
      type: def.type,
      enabled: f.enabled !== false,
      params,
    });
    if (out.length >= MAX_FILTERS) break;
  }
  return out;
}
