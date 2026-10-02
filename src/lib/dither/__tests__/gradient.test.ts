import { describe, expect, it } from "vitest";
import { baseSettings } from "../defaults";
import { assignBands, bandSizes, ditherGradient, gradientPosition } from "../gradient";
import { processImage } from "../pipeline";
import { resample } from "../resize";
import type { DitherSettings, PixelBuffer } from "../types";
import { gradient as rampImage, uniqueColors } from "./helpers";

const settingsWith = (patch: Partial<DitherSettings["gradient"]>): DitherSettings => {
  const s = baseSettings();
  // Hard band edges unless a test asks for scatter.
  s.gradient = { ...s.gradient, enabled: true, scatter: 0, ...patch };
  return s;
};

describe("gradientPosition", () => {
  const g = { direction: "right" as const, from: 0, to: 1 };

  it("runs 0→1 along each direction", () => {
    expect(gradientPosition(g, 0, 5, 11, 11)).toBe(0);
    expect(gradientPosition(g, 10, 5, 11, 11)).toBe(1);
    expect(gradientPosition({ ...g, direction: "left" }, 0, 5, 11, 11)).toBe(1);
    expect(gradientPosition({ ...g, direction: "down" }, 5, 10, 11, 11)).toBe(1);
    expect(gradientPosition({ ...g, direction: "up" }, 5, 10, 11, 11)).toBe(0);
  });

  it("radial is 0 at the centre and 1 at the corners", () => {
    expect(gradientPosition({ ...g, direction: "radial" }, 5, 5, 11, 11)).toBe(0);
    expect(gradientPosition({ ...g, direction: "radial" }, 0, 0, 11, 11)).toBeCloseTo(1);
  });

  it("maps the from/to range and handles a zero-width range as a hard step", () => {
    const mid = { ...g, from: 0.25, to: 0.75 };
    expect(gradientPosition(mid, 2, 0, 11, 1)).toBe(0); // 0.2
    expect(gradientPosition(mid, 5, 0, 11, 1)).toBeCloseTo(0.5);
    expect(gradientPosition(mid, 9, 0, 11, 1)).toBe(1); // 0.9
    const step = { ...g, from: 0.5, to: 0.5 };
    expect(gradientPosition(step, 4, 0, 11, 1)).toBe(0);
    expect(gradientPosition(step, 6, 0, 11, 1)).toBe(1);
  });
});

describe("bandSizes", () => {
  it("interpolates linearly from start to end", () => {
    expect(bandSizes({ startSize: 1, endSize: 8, bands: 8 })).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(bandSizes({ startSize: 1, endSize: 4, bands: 4 })).toEqual([1, 2, 3, 4]);
  });

  it("works in reverse and clamps nonsense", () => {
    expect(bandSizes({ startSize: 6, endSize: 2, bands: 3 })).toEqual([6, 4, 2]);
    expect(bandSizes({ startSize: 0, endSize: 0, bands: 1 })).toEqual([1, 1]);
  });
});

describe("ditherGradient", () => {
  const W = 96;
  const H = 32;
  const src = rampImage(W, H);
  const resampler = (w: number, h: number) => resample(src, w, h);

  /** True when every size×size block (aligned to 0,0) inside [x0, x1) is one colour. */
  const blocksUniform = (img: PixelBuffer, size: number, x0: number, x1: number) => {
    for (let by = 0; by + size <= img.height; by += size) {
      for (let bx = Math.ceil(x0 / size) * size; bx + size <= x1; bx += size) {
        const ref = (by * img.width + bx) * 4;
        for (let y = by; y < by + size; y++) {
          for (let x = bx; x < bx + size; x++) {
            const p = (y * img.width + x) * 4;
            if (img.data[p] !== img.data[ref] || img.data[p + 1] !== img.data[ref + 1]) return false;
          }
        }
      }
    }
    return true;
  };

  it("keeps the output size and grows dots band by band", () => {
    const s = settingsWith({ startSize: 1, endSize: 4, bands: 4, fadeIn: false });
    const out = ditherGradient(resampler, W, H, s);
    expect([out.width, out.height]).toEqual([W, H]);
    // Band 4 (x 72..95) uses 4px dots, band 3 (x 48..71) 3px dots.
    expect(blocksUniform(out, 4, 72, 96)).toBe(true);
    expect(blocksUniform(out, 3, 48, 72)).toBe(true);
    // The first band is at full resolution, so 4px blocks there are not uniform.
    expect(blocksUniform(out, 4, 0, 24)).toBe(false);
  });

  it("without fade, only palette colours appear", () => {
    const out = ditherGradient(resampler, W, H, settingsWith({ fadeIn: false }));
    expect(uniqueColors(out)).toEqual(new Set(["9,9,11", "250,250,250"]));
  });

  it("fade starts from the original image and ends fully dithered", () => {
    const s = settingsWith({ startSize: 1, endSize: 1, bands: 2, fadeIn: true });
    const out = ditherGradient(resampler, W, H, s);
    // First column: t = 0, so every pixel is the untouched source.
    for (let y = 0; y < H; y++) expect(out.data[y * W * 4]).toBe(src.data[y * W * 4]);
    // Last column: t = 1, so only palette colours.
    const last = new Set<number>();
    for (let y = 0; y < H; y++) last.add(out.data[(y * W + W - 1) * 4]);
    for (const v of last) expect([9, 250]).toContain(v);
  });

  it("processImage only uses the gradient when enabled", () => {
    const off = baseSettings();
    const on = settingsWith({ fadeIn: false, startSize: 2, endSize: 6 });
    off.resize = on.resize = { ...off.resize, mode: "width", width: 48 };
    const plain = processImage(src, off);
    const grad = processImage(src, on);
    expect([grad.width, grad.height]).toEqual([plain.width, plain.height]);
    expect(grad.data).not.toEqual(plain.data);
    off.gradient.enabled = false;
    expect(processImage(src, off).data).toEqual(plain.data);
  });
});

describe("assignBands scatter", () => {
  const W = 120;
  const H = 40;
  const base = { ...baseSettings().gradient, enabled: true, startSize: 1, endSize: 6, bands: 6 };

  const monotonicRows = (band: Uint8Array) => {
    for (let y = 0; y < H; y++) {
      for (let x = 1; x < W; x++) if (band[y * W + x] < band[y * W + x - 1]) return false;
    }
    return true;
  };

  it("without scatter, bands step strictly along the direction", () => {
    expect(monotonicRows(assignBands({ ...base, scatter: 0 }, W, H).band)).toBe(true);
  });

  it("with scatter, neighbouring bands interleave across the boundaries", () => {
    const { band } = assignBands({ ...base, scatter: 0.4 }, W, H);
    expect(monotonicRows(band)).toBe(false);
    // Every band still shows up.
    expect(new Set(band).size).toBe(6);
  });

  it("the biggest dots stay whole squares", () => {
    const { band } = assignBands({ ...base, scatter: 0.6, seed: 3 }, W, H);
    const size = 6;
    for (let by = 0; by + size <= H; by += size) {
      for (let bx = 0; bx + size <= W; bx += size) {
        const cell: number[] = [];
        for (let y = by; y < by + size; y++) for (let x = bx; x < bx + size; x++) cell.push(band[y * W + x]);
        const big = cell.filter((b) => b === 5).length;
        expect([0, size * size]).toContain(big);
      }
    }
  });

  it("is deterministic per seed", () => {
    const a = assignBands({ ...base, seed: 7 }, W, H).band;
    expect(assignBands({ ...base, seed: 7 }, W, H).band).toEqual(a);
    expect(assignBands({ ...base, seed: 8 }, W, H).band).not.toEqual(a);
  });
});

describe("gradient defaults", () => {
  it("starts disabled, with fade from original off", () => {
    const g = baseSettings().gradient;
    expect(g.enabled).toBe(false);
    expect(g.fadeIn).toBe(false);
  });
});
