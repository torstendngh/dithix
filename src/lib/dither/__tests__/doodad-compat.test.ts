import { describe, expect, it } from "vitest";
import { BUILTIN_PRESETS } from "@/stores/preset-store";
import { dither } from "../algorithms";
import { baseSettings } from "../defaults";
import { hexToRgb, PaletteMatcher } from "../color";
import { resample } from "../resize";
import type { PixelBuffer } from "../types";

/**
 * Reference port of doodad.dev "Dither Me This" ordered dithering (8×8):
 * every channel gets `matrix[y][x] / 64 * 64` added, then plain RGB nearest colour.
 * The matrix is copied verbatim, including its duplicated 32 (should be 23).
 */
const DOODAD_8X8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 32],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

function doodadOrdered(src: PixelBuffer, palette: string[]): PixelBuffer {
  const pal = palette.map(hexToRgb);
  const out = new Uint8ClampedArray(src.data.length);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const p = (y * src.width + x) * 4;
      const f = (DOODAD_8X8[y % 8][x % 8] / 64) * 64;
      const r = src.data[p] + f;
      const g = src.data[p + 1] + f;
      const b = src.data[p + 2] + f;
      let best = pal[0];
      let bestD = Infinity;
      for (const c of pal) {
        const d = Math.hypot(r - c[0], g - c[1], b - c[2]);
        if (d < bestD) ((bestD = d), (best = c));
      }
      out.set([...best, 255], p);
    }
  }
  return { width: src.width, height: src.height, data: out };
}

/** Photo-like test image with smooth gradients and texture across the palette's range. */
function testImage(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(
        [(x * 0.6 + 40 * Math.sin(y / 9)) & 255, y + 30 * Math.sin(x / 13), (x + y) / 2, 255],
        (y * width + x) * 4,
      );
    }
  }
  return { width, height, data };
}

const agreement = (a: PixelBuffer, b: PixelBuffer) => {
  let same = 0;
  for (let p = 0; p < a.data.length; p += 4) {
    if (a.data[p] === b.data[p] && a.data[p + 1] === b.data[p + 1] && a.data[p + 2] === b.data[p + 2]) same++;
  }
  return same / (a.data.length / 4);
};

describe("doodad.dev compatibility", () => {
  const preset = BUILTIN_PRESETS.find((p) => p.name === "Zinc Mint")!;
  const { dither: opts, palette } = preset.settings;
  const src = testImage(256, 256);
  const reference = doodadOrdered(src, palette.colors);
  const matcher = () => new PaletteMatcher(palette.colors.map(hexToRgb), palette.distance);

  it("Zinc Mint matches doodad's ordered 8×8 output almost exactly", () => {
    // The only differences come from doodad's typo cell in the matrix (1 of 64 positions).
    expect(agreement(dither(src, opts, matcher()), reference)).toBeGreaterThan(0.995);
  });

  it("the default centred, palette-scaled spread is noticeably different", () => {
    const centred = { ...opts, spreadMode: "auto" as const, bias: 0, transpose: false };
    expect(agreement(dither(src, centred, matcher()), reference)).toBeLessThan(0.8);
  });
});

describe("ordered options", () => {
  const bw = () => new PaletteMatcher([[0, 0, 0], [255, 255, 255]]);
  const base = baseSettings().dither;
  const grey = testImage(64, 64);

  it("positive bias brightens, negative bias darkens", () => {
    const mean = (b: PixelBuffer) => b.data.reduce((s, v, i) => (i % 4 === 0 ? s + v : s), 0);
    const neutral = mean(dither(grey, { ...base, bias: 0 }, bw()));
    expect(mean(dither(grey, { ...base, bias: 0.3 }, bw()))).toBeGreaterThan(neutral);
    expect(mean(dither(grey, { ...base, bias: -0.3 }, bw()))).toBeLessThan(neutral);
  });

  it("transpose mirrors the pattern across the diagonal", () => {
    const flat: PixelBuffer = { width: 8, height: 8, data: new Uint8ClampedArray(256).fill(100) };
    for (let i = 3; i < 256; i += 4) flat.data[i] = 255;
    const a = dither(flat, { ...base, algorithm: "bayer8", transpose: false }, bw());
    const b = dither(flat, { ...base, algorithm: "bayer8", transpose: true }, bw());
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) expect(b.data[(y * 8 + x) * 4]).toBe(a.data[(x * 8 + y) * 4]);
    }
  });

  it("fixed spread ignores the palette spacing", () => {
    const g4 = new PaletteMatcher([[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]]);
    const fixed = { ...base, spreadMode: "fixed" as const, spread: 0 };
    const threshold = { ...base, algorithm: "threshold" as const };
    expect(dither(grey, fixed, g4).data).toEqual(dither(grey, threshold, g4).data);
  });
});

describe("bilinear resample", () => {
  it("samples pixel centres", () => {
    // 4 → 2 px: each output sits exactly between two inputs.
    const src: PixelBuffer = {
      width: 4,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 255, 255, 255, 255]),
    };
    const out = resample(src, 2, 1, "bilinear");
    expect(out.data[0]).toBe(50);
    expect(out.data[4]).toBe(228);
  });

  it("keeps detail that area averaging blends away", () => {
    // 1px white stripe every 3px, shrunk 3×: bilinear lands on the stripe centres,
    // area averaging blends each 3px block into grey.
    const w = 30;
    const data = new Uint8ClampedArray(w * 4);
    for (let x = 0; x < w; x++) data.set(x % 3 === 1 ? [255, 255, 255, 255] : [0, 0, 0, 255], x * 4);
    const src = { width: w, height: 1, data };
    expect(resample(src, 10, 1, "bilinear").data[0]).toBe(255);
    expect(resample(src, 10, 1, "area").data[0]).toBe(85);
  });
});
