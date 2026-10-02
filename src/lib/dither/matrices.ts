/** Threshold maps for ordered dithering. All maps return values in [0, 1). */

export interface ThresholdMatrix {
  width: number;
  height: number;
  /** Integer ranks 0..width*height-1, row-major. */
  ranks: Uint16Array;
}

/** Recursive Bayer index matrix: M(2n) = [[4M, 4M+2], [4M+3, 4M+1]]. */
export function bayerMatrix(size: number): ThresholdMatrix {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`Bayer size must be a power of two ≥ 2, got ${size}`);
  }
  let n = 1;
  let m = new Uint16Array([0]);
  while (n < size) {
    const next = new Uint16Array(n * 2 * n * 2);
    const n2 = n * 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = m[y * n + x] * 4;
        next[y * n2 + x] = v;
        next[y * n2 + x + n] = v + 2;
        next[(y + n) * n2 + x] = v + 3;
        next[(y + n) * n2 + x + n] = v + 1;
      }
    }
    m = next;
    n = n2;
  }
  return { width: size, height: size, ranks: m };
}

/** Turns arbitrary per-cell keys into ranks (lowest key = rank 0); ties keep cell order. */
export function rankKeys(width: number, height: number, keys: number[][]): ThresholdMatrix {
  const cells: { i: number; k: number[] }[] = [];
  for (let i = 0; i < width * height; i++) cells.push({ i, k: keys[i] });
  cells.sort((a, b) => {
    for (let j = 0; j < a.k.length; j++) {
      const d = a.k[j] - b.k[j];
      if (Math.abs(d) > 1e-9) return d;
    }
    return a.i - b.i;
  });
  const ranks = new Uint16Array(width * height);
  cells.forEach((c, r) => (ranks[c.i] = r));
  return { width, height, ranks };
}

/** Clustered dot: dot grows outward from the cell centre. */
export function clusterMatrix(size: number): ThresholdMatrix {
  const c = (size - 1) / 2;
  const keys: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      keys.push([dx * dx + dy * dy, Math.atan2(dy, dx)]);
    }
  }
  return rankKeys(size, size, keys);
}

/** 45° Euclidean-dot halftone screen. */
export function halftoneMatrix(size = 8): ThresholdMatrix {
  const keys: number[][] = [];
  const bayer = bayerMatrix(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (2 * Math.PI * (x + 0.5)) / size;
      const b = (2 * Math.PI * (y + 0.5)) / size;
      keys.push([-(Math.cos(a) + Math.cos(b)), bayer.ranks[y * size + x]]);
    }
  }
  return rankKeys(size, size, keys);
}

export function linesMatrix(direction: "h" | "v" | "d", size = 8): ThresholdMatrix {
  const keys: number[][] = [];
  const bayer = bayerMatrix(size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = direction === "h" ? y : direction === "v" ? x : (x + y) % size;
      keys.push([Math.abs(t - c), bayer.ranks[y * size + x]]);
    }
  }
  return rankKeys(size, size, keys);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Order-independent hash noise in [0, 1). */
export function hashNoise(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Interleaved gradient noise (Jimenez 2014). */
export function ign(x: number, y: number): number {
  const f = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
  return f % 1;
}

/**
 * Void-and-cluster blue noise (Ulichney 1993) on a toroidal grid.
 */
export function blueNoiseMatrix(size = 64, seed = 1, sigma = 1.5): ThresholdMatrix {
  const n = size * size;
  const rand = mulberry32(seed);

  // Toroidal Gaussian kernel indexed by wrapped offset.
  const kernel = new Float32Array(n);
  const s2 = 2 * sigma * sigma;
  for (let y = 0; y < size; y++) {
    const dy = Math.min(y, size - y);
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - x);
      kernel[y * size + x] = Math.exp(-(dx * dx + dy * dy) / s2);
    }
  }

  const energy = new Float32Array(n);
  const bits = new Uint8Array(n);
  const toggle = (i: number, on: boolean) => {
    bits[i] = on ? 1 : 0;
    const sign = on ? 1 : -1;
    const px = i % size;
    const py = (i / size) | 0;
    for (let y = 0; y < size; y++) {
      const ky = ((y - py + size) % size) * size;
      const row = y * size;
      for (let x = 0; x < size; x++) {
        energy[row + x] += sign * kernel[ky + ((x - px + size) % size)];
      }
    }
  };
  const tightestCluster = () => {
    let best = -1;
    let max = -Infinity;
    for (let i = 0; i < n; i++) if (bits[i] && energy[i] > max) ((max = energy[i]), (best = i));
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let min = Infinity;
    for (let i = 0; i < n; i++) if (!bits[i] && energy[i] < min) ((min = energy[i]), (best = i));
    return best;
  };

  // Initial pattern: ~10% random minority pixels, relaxed until stable.
  const initial = Math.max(1, Math.floor(n / 10));
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rand() * n);
    if (!bits[i]) {
      toggle(i, true);
      placed++;
    }
  }
  for (let guard = 0; guard < n; guard++) {
    const c = tightestCluster();
    toggle(c, false);
    const v = largestVoid();
    if (v === c) {
      toggle(c, true);
      break;
    }
    toggle(v, true);
  }

  const prototype = bits.slice();
  const protoEnergy = energy.slice();
  const ranks = new Uint16Array(n);

  // Phase 1: remove clusters from the prototype, ranking downwards.
  let ones = initial;
  while (ones > 0) {
    const c = tightestCluster();
    toggle(c, false);
    ones--;
    ranks[c] = ones;
  }

  // Phase 2+3: fill voids from the prototype upwards.
  bits.set(prototype);
  energy.set(protoEnergy);
  ones = initial;
  while (ones < n) {
    const v = largestVoid();
    toggle(v, true);
    ranks[v] = ones;
    ones++;
  }

  return { width: size, height: size, ranks };
}

const matrixCache = new Map<string, ThresholdMatrix>();

export function cachedMatrix(key: string, build: () => ThresholdMatrix): ThresholdMatrix {
  let m = matrixCache.get(key);
  if (!m) {
    m = build();
    matrixCache.set(key, m);
  }
  return m;
}

/** Normalised threshold function in [0, 1) for a matrix. */
export function matrixThreshold(m: ThresholdMatrix): (x: number, y: number) => number {
  const { width, height, ranks } = m;
  const total = width * height;
  const values = new Float32Array(total);
  for (let i = 0; i < total; i++) values[i] = (ranks[i] + 0.5) / total;
  return (x, y) => values[(y % height) * width + (x % width)];
}
