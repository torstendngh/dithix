import { PaletteMatcher } from "./color";
import {
  bayerMatrix,
  blueNoiseMatrix,
  cachedMatrix,
  clusterMatrix,
  halftoneMatrix,
  hashNoise,
  ign,
  linesMatrix,
  matrixThreshold,
} from "./matrices";
import type { AlgorithmId, AlgorithmKind, DitherOptions, PixelBuffer } from "./types";

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  kind: AlgorithmKind;
  group: string;
}

export const ALGORITHMS: AlgorithmInfo[] = [
  { id: "bayer2", name: "Bayer 2×2", kind: "ordered", group: "Bayer" },
  { id: "bayer4", name: "Bayer 4×4", kind: "ordered", group: "Bayer" },
  { id: "bayer8", name: "Bayer 8×8", kind: "ordered", group: "Bayer" },
  { id: "bayer16", name: "Bayer 16×16", kind: "ordered", group: "Bayer" },
  { id: "bayer32", name: "Bayer 32×32", kind: "ordered", group: "Bayer" },
  { id: "cluster4", name: "Cluster dot 4×4", kind: "ordered", group: "Ordered" },
  { id: "cluster8", name: "Cluster dot 8×8", kind: "ordered", group: "Ordered" },
  { id: "halftone", name: "Halftone 45°", kind: "ordered", group: "Ordered" },
  { id: "lines-h", name: "Lines horizontal", kind: "ordered", group: "Ordered" },
  { id: "lines-v", name: "Lines vertical", kind: "ordered", group: "Ordered" },
  { id: "lines-d", name: "Lines diagonal", kind: "ordered", group: "Ordered" },
  { id: "blue-noise", name: "Blue noise", kind: "ordered", group: "Noise" },
  { id: "ign", name: "Interleaved gradient", kind: "ordered", group: "Noise" },
  { id: "white-noise", name: "White noise", kind: "ordered", group: "Noise" },
  { id: "floyd-steinberg", name: "Floyd–Steinberg", kind: "diffusion", group: "Error diffusion" },
  { id: "false-floyd-steinberg", name: "False Floyd–Steinberg", kind: "diffusion", group: "Error diffusion" },
  { id: "jarvis-judice-ninke", name: "Jarvis–Judice–Ninke", kind: "diffusion", group: "Error diffusion" },
  { id: "stucki", name: "Stucki", kind: "diffusion", group: "Error diffusion" },
  { id: "burkes", name: "Burkes", kind: "diffusion", group: "Error diffusion" },
  { id: "sierra3", name: "Sierra", kind: "diffusion", group: "Error diffusion" },
  { id: "sierra2", name: "Sierra two-row", kind: "diffusion", group: "Error diffusion" },
  { id: "sierra-lite", name: "Sierra lite", kind: "diffusion", group: "Error diffusion" },
  { id: "atkinson", name: "Atkinson", kind: "diffusion", group: "Error diffusion" },
  { id: "riemersma", name: "Riemersma (Hilbert)", kind: "curve", group: "Other" },
  { id: "threshold", name: "Threshold (none)", kind: "threshold", group: "Other" },
];

export const ALGORITHM_GROUPS = [...new Set(ALGORITHMS.map((a) => a.group))];

export function getAlgorithm(id: AlgorithmId): AlgorithmInfo {
  const info = ALGORITHMS.find((a) => a.id === id);
  if (!info) throw new Error(`Unknown algorithm: ${id}`);
  return info;
}

/** [dx, dy, weight] entries plus the divisor. */
type Kernel = { taps: [number, number, number][]; divisor: number };

export const DIFFUSION_KERNELS: Record<string, Kernel> = {
  "floyd-steinberg": { divisor: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  "false-floyd-steinberg": { divisor: 8, taps: [[1, 0, 3], [0, 1, 3], [1, 1, 2]] },
  "jarvis-judice-ninke": {
    divisor: 48,
    taps: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
  },
  stucki: {
    divisor: 42,
    taps: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
    ],
  },
  burkes: {
    divisor: 32,
    taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]],
  },
  sierra3: {
    divisor: 32,
    taps: [
      [1, 0, 5], [2, 0, 3],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
      [-1, 2, 2], [0, 2, 3], [1, 2, 2],
    ],
  },
  sierra2: {
    divisor: 16,
    taps: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]],
  },
  "sierra-lite": { divisor: 4, taps: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
  // Atkinson intentionally only diffuses 6/8 of the error.
  atkinson: { divisor: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
};

export function thresholdFunction(id: AlgorithmId, seed: number): (x: number, y: number) => number {
  switch (id) {
    case "bayer2":
    case "bayer4":
    case "bayer8":
    case "bayer16":
    case "bayer32": {
      const size = Number(id.slice(5));
      return matrixThreshold(cachedMatrix(id, () => bayerMatrix(size)));
    }
    case "cluster4":
      return matrixThreshold(cachedMatrix(id, () => clusterMatrix(4)));
    case "cluster8":
      return matrixThreshold(cachedMatrix(id, () => clusterMatrix(8)));
    case "halftone":
      return matrixThreshold(cachedMatrix(id, () => halftoneMatrix(8)));
    case "lines-h":
      return matrixThreshold(cachedMatrix(id, () => linesMatrix("h")));
    case "lines-v":
      return matrixThreshold(cachedMatrix(id, () => linesMatrix("v")));
    case "lines-d":
      return matrixThreshold(cachedMatrix(id, () => linesMatrix("d")));
    case "blue-noise":
      return matrixThreshold(cachedMatrix(`blue-${seed}`, () => blueNoiseMatrix(64, seed)));
    case "ign":
      return ign;
    case "white-noise":
      return (x, y) => hashNoise(x, y, seed);
    default:
      throw new Error(`${id} is not an ordered algorithm`);
  }
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function blankOutput(src: PixelBuffer): PixelBuffer {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.width * src.height * 4) };
}

function writeColor(out: Uint8ClampedArray, p: number, matcher: PaletteMatcher, idx: number) {
  const c = matcher.colors[idx];
  out[p] = c[0];
  out[p + 1] = c[1];
  out[p + 2] = c[2];
  out[p + 3] = 255;
}

function ditherOrdered(src: PixelBuffer, opts: DitherOptions, matcher: PaletteMatcher): PixelBuffer {
  const out = blankOutput(src);
  const { width, height, data } = src;
  const base = opts.algorithm === "threshold" ? null : thresholdFunction(opts.algorithm, opts.seed);
  const oriented = base && opts.transpose ? (x: number, y: number) => base(y, x) : base;
  // Motion's pattern crawl slides the pattern on screen (non-negative offsets keep the matrix
  // modulo valid), applied after transposing so the direction matches what you picked.
  const ox = opts.offsetX ?? 0;
  const oy = opts.offsetY ?? 0;
  const threshold = oriented && (ox || oy) ? (x: number, y: number) => oriented(x + ox, y + oy) : oriented;
  const spread = opts.spreadMode === "fixed" ? opts.spread : matcher.autoSpread() * opts.strength;
  const shift = opts.bias - 0.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (data[p + 3] < 128) continue;
      const o = threshold ? (threshold(x, y) + shift) * spread : 0;
      writeColor(out.data, p, matcher, matcher.nearest(data[p] + o, data[p + 1] + o, data[p + 2] + o));
    }
  }
  return out;
}

function ditherDiffusion(src: PixelBuffer, opts: DitherOptions, matcher: PaletteMatcher): PixelBuffer {
  const kernel = DIFFUSION_KERNELS[opts.algorithm];
  const out = blankOutput(src);
  const { width, height, data } = src;
  const work = new Float32Array(width * height * 3);
  for (let i = 0, p = 0; i < work.length; i += 3, p += 4) {
    work[i] = data[p];
    work[i + 1] = data[p + 1];
    work[i + 2] = data[p + 2];
  }
  const strength = Math.max(0, Math.min(1, opts.strength));
  const taps = kernel.taps.map(([dx, dy, w]) => [dx, dy, (w / kernel.divisor) * strength] as const);

  for (let y = 0; y < height; y++) {
    const reverse = opts.serpentine && y % 2 === 1;
    for (let i = 0; i < width; i++) {
      const x = reverse ? width - 1 - i : i;
      const idx = y * width + x;
      const p = idx * 4;
      if (data[p + 3] < 128) continue;
      const w = idx * 3;
      // Clamping the accumulated value keeps error from smearing across large flat areas.
      const r = clamp255(work[w]);
      const g = clamp255(work[w + 1]);
      const b = clamp255(work[w + 2]);
      const ci = matcher.nearest(r, g, b);
      writeColor(out.data, p, matcher, ci);
      const c = matcher.colors[ci];
      const er = r - c[0];
      const eg = g - c[1];
      const eb = b - c[2];
      for (const [tdx, dy, f] of taps) {
        const nx = x + (reverse ? -tdx : tdx);
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const n = (ny * width + nx) * 3;
        work[n] += er * f;
        work[n + 1] += eg * f;
        work[n + 2] += eb * f;
      }
    }
  }
  return out;
}

/** Hilbert curve index → (x, y) for an n×n grid (n power of two). */
export function hilbertD2xy(n: number, d: number): [number, number] {
  let x = 0;
  let y = 0;
  let t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2);
    const ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}

function ditherRiemersma(src: PixelBuffer, opts: DitherOptions, matcher: PaletteMatcher): PixelBuffer {
  const out = blankOutput(src);
  const { width, height, data } = src;
  const Q = 16;
  const ratio = 16;
  const weights = Array.from({ length: Q }, (_, i) => Math.pow(ratio, i / (Q - 1)));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const strength = Math.max(0, Math.min(1, opts.strength));
  // Oldest error at index 0 (smallest weight), newest at Q-1.
  const hist = Array.from({ length: Q }, () => [0, 0, 0]);

  let n = 1;
  while (n < Math.max(width, height)) n *= 2;
  const total = n * n;
  for (let d = 0; d < total; d++) {
    const [x, y] = hilbertD2xy(n, d);
    if (x >= width || y >= height) continue;
    const p = (y * width + x) * 4;
    if (data[p + 3] < 128) continue;
    let er = 0;
    let eg = 0;
    let eb = 0;
    for (let i = 0; i < Q; i++) {
      er += hist[i][0] * weights[i];
      eg += hist[i][1] * weights[i];
      eb += hist[i][2] * weights[i];
    }
    const k = strength / wsum;
    const r = data[p] + er * k;
    const g = data[p + 1] + eg * k;
    const b = data[p + 2] + eb * k;
    const ci = matcher.nearest(r, g, b);
    writeColor(out.data, p, matcher, ci);
    const c = matcher.colors[ci];
    const oldest = hist.shift()!;
    oldest[0] = r - c[0];
    oldest[1] = g - c[1];
    oldest[2] = b - c[2];
    hist.push(oldest);
  }
  return out;
}

export function dither(src: PixelBuffer, opts: DitherOptions, matcher: PaletteMatcher): PixelBuffer {
  const { kind } = getAlgorithm(opts.algorithm);
  switch (kind) {
    case "diffusion":
      return ditherDiffusion(src, opts, matcher);
    case "curve":
      return ditherRiemersma(src, opts, matcher);
    default:
      return ditherOrdered(src, opts, matcher);
  }
}
