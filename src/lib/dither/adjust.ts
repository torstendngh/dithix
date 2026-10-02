import type { AdjustSettings, CurvePoint, Curves, PixelBuffer } from "./types";

export const IDENTITY_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export function identityCurves(): Curves {
  return {
    master: IDENTITY_CURVE.map((p) => ({ ...p })),
    r: IDENTITY_CURVE.map((p) => ({ ...p })),
    g: IDENTITY_CURVE.map((p) => ({ ...p })),
    b: IDENTITY_CURVE.map((p) => ({ ...p })),
  };
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  return points.every((p) => p.x === p.y);
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Builds a 256-entry LUT from control points using monotone cubic (Fritsch–Carlson)
 * interpolation, so curves never overshoot between points.
 */
export function buildCurveLut(input: CurvePoint[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const pts = [...input]
    .sort((a, b) => a.x - b.x)
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x);

  if (pts.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  if (pts.length === 1) {
    lut.fill(clamp255(pts[0].y));
    return lut;
  }

  const n = pts.length;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }

  let seg = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= xs[0]) {
      lut[x] = clamp255(ys[0]);
      continue;
    }
    if (x >= xs[n - 1]) {
      lut[x] = clamp255(ys[n - 1]);
      continue;
    }
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg];
    const t = (x - xs[seg]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * ys[seg] +
      (t3 - 2 * t2 + t) * h * m[seg] +
      (-2 * t3 + 3 * t2) * ys[seg + 1] +
      (t3 - t2) * h * m[seg + 1];
    lut[x] = clamp255(Math.round(y));
  }
  return lut;
}

/** brightness → contrast → gamma, as a single per-channel LUT. */
export function buildToneLut(brightness: number, contrast: number, gamma: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const b = (brightness / 100) * 255;
  const c = contrast / 100;
  // Symmetric contrast factor: -100 → flat grey, +100 → near-threshold.
  const factor = c >= 0 ? 1 / Math.max(1 - c, 0.0001) : 1 + c;
  const g = 1 / Math.max(gamma, 0.01);
  for (let i = 0; i < 256; i++) {
    let v = i + b;
    v = (v - 127.5) * factor + 127.5;
    v = clamp255(v);
    v = 255 * Math.pow(v / 255, g);
    lut[i] = v;
  }
  return lut;
}

export function isNeutralAdjust(a: AdjustSettings): boolean {
  return (
    a.brightness === 0 &&
    a.contrast === 0 &&
    a.gamma === 1 &&
    a.saturation === 0 &&
    !a.invert &&
    isIdentityCurve(a.curves.master) &&
    isIdentityCurve(a.curves.r) &&
    isIdentityCurve(a.curves.g) &&
    isIdentityCurve(a.curves.b)
  );
}

/** Applies tone, saturation, curves and invert. Returns a new buffer; alpha is kept. */
export function applyAdjustments(src: PixelBuffer, a: AdjustSettings): PixelBuffer {
  const out = new Uint8ClampedArray(src.data);
  if (isNeutralAdjust(a)) return { width: src.width, height: src.height, data: out };

  const tone = buildToneLut(a.brightness, a.contrast, a.gamma);
  const master = buildCurveLut(a.curves.master);
  const chan = [buildCurveLut(a.curves.r), buildCurveLut(a.curves.g), buildCurveLut(a.curves.b)];
  // Fold master curve, channel curve and invert into one LUT per channel.
  const post = chan.map((lut) => {
    const combined = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const v = lut[master[i]];
      combined[i] = a.invert ? 255 - v : v;
    }
    return combined;
  });
  const sat = 1 + a.saturation / 100;
  const doSat = a.saturation !== 0;

  for (let p = 0; p < out.length; p += 4) {
    let r = tone[out[p]];
    let g = tone[out[p + 1]];
    let b = tone[out[p + 2]];
    if (doSat) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = clamp255(l + (r - l) * sat);
      g = clamp255(l + (g - l) * sat);
      b = clamp255(l + (b - l) * sat);
    }
    out[p] = post[0][r | 0];
    out[p + 1] = post[1][g | 0];
    out[p + 2] = post[2][b | 0];
  }
  return { width: src.width, height: src.height, data: out };
}
