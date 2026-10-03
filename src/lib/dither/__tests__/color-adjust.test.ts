import { describe, expect, it } from "vitest";
import { applyAdjustments, buildCurveLut, buildToneLut, identityCurves } from "../adjust";
import { hexToRgb, isHex, PaletteMatcher, rgbToHex } from "../color";
import { baseSettings } from "../defaults";
import type { AdjustSettings } from "../types";
import { solid } from "./helpers";

describe("hex helpers", () => {
  it("round-trips colours", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
    expect(hexToRgb("0f0")).toEqual([0, 255, 0]);
    expect(rgbToHex([255, 128, 0])).toBe("#ff8000");
    expect(rgbToHex([300, -4, 12.4])).toBe("#ff000c");
  });

  it("validates", () => {
    expect(isHex("#abc")).toBe(true);
    expect(isHex("#abcd")).toBe(false);
    expect(isHex(4)).toBe(false);
    expect(isHex(null)).toBe(false);
    expect(() => hexToRgb("nope")).toThrow();
  });
});

describe("PaletteMatcher", () => {
  const bw = new PaletteMatcher([[0, 0, 0], [255, 255, 255]]);

  it("finds the nearest colour and clamps out-of-range input", () => {
    expect(bw.nearest(100, 100, 100)).toBe(0);
    expect(bw.nearest(200, 200, 200)).toBe(1);
    expect(bw.nearest(-50, 400, 900)).toBe(1);
  });

  it("auto spread equals 255 for black/white and one step for even greys", () => {
    expect(bw.autoSpread()).toBeCloseTo(255, 0);
    const g4 = new PaletteMatcher([[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]]);
    expect(g4.autoSpread()).toBeCloseTo(85, 0);
  });

  it("luma distance prefers brightness matches over hue", () => {
    const colors: [number, number, number][] = [
      [0, 0, 255],
      [128, 128, 128],
    ];
    // Very dark blue: closer to grey in RGB space, but much closer to blue in brightness.
    expect(new PaletteMatcher(colors, "rgb").nearest(0, 0, 40)).toBe(1);
    expect(new PaletteMatcher(colors, "luma").nearest(0, 0, 40)).toBe(0);
  });

  it("rejects empty palettes", () => {
    expect(() => new PaletteMatcher([])).toThrow();
  });
});

describe("buildCurveLut", () => {
  it("identity curve gives identity LUT", () => {
    const lut = buildCurveLut(identityCurves().master);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i);
  });

  it("passes through control points and stays monotone", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 64, y: 32 },
      { x: 192, y: 230 },
      { x: 255, y: 255 },
    ];
    const lut = buildCurveLut(pts);
    expect(lut[64]).toBe(32);
    expect(lut[192]).toBe(230);
    for (let i = 1; i < 256; i++) expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
  });

  it("holds the end values outside the point range and handles unsorted input", () => {
    const lut = buildCurveLut([
      { x: 200, y: 50 },
      { x: 50, y: 200 },
    ]);
    expect(lut[0]).toBe(200);
    expect(lut[255]).toBe(50);
  });
});

describe("tone & adjustments", () => {
  const adjust = (patch: Partial<AdjustSettings>): AdjustSettings => ({ ...baseSettings().adjust, ...patch });

  it("neutral tone LUT is identity", () => {
    const lut = buildToneLut(0, 0, 1);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i);
  });

  it("brightness and contrast move values in the expected direction", () => {
    expect(buildToneLut(50, 0, 1)[100]).toBeGreaterThan(100);
    expect(buildToneLut(0, 50, 1)[64]).toBeLessThan(64);
    expect(buildToneLut(0, 50, 1)[192]).toBeGreaterThan(192);
    expect(buildToneLut(0, -100, 1)[0]).toBe(128);
  });

  it("gamma > 1 brightens mid-tones", () => {
    expect(buildToneLut(0, 0, 2)[128]).toBeGreaterThan(128);
  });

  it("invert and grayscale", () => {
    const src = solid(1, 1, [255, 0, 0, 200]);
    expect([...applyAdjustments(src, adjust({ invert: true })).data]).toEqual([0, 255, 255, 200]);
    const gray = applyAdjustments(src, adjust({ saturation: -100 })).data;
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);
  });

  it("hue rotates colours round the wheel, keeps greys and is neutral at ±0", () => {
    const px = (rgb: [number, number, number], hue: number) => [...applyAdjustments(solid(1, 1, [...rgb, 255]), adjust({ hue })).data.slice(0, 3)];
    const [r, g, b] = px([200, 30, 30], 120); // red → green
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    const [r2, g2, b2] = px([200, 30, 30], -120); // red → blue
    expect(b2).toBeGreaterThan(r2);
    expect(b2).toBeGreaterThan(g2);
    expect(px([128, 128, 128], 90)).toEqual([128, 128, 128]);
    expect(px([200, 30, 30], 360 - 360)).toEqual([200, 30, 30]);
  });

  it("applies the master curve to all channels", () => {
    const curves = identityCurves();
    curves.master = [
      { x: 0, y: 255 },
      { x: 255, y: 0 },
    ];
    const out = applyAdjustments(solid(1, 1, [0, 255, 10, 255]), adjust({ curves })).data;
    expect([...out]).toEqual([255, 0, 245, 255]);
  });

  it("does not mutate the input", () => {
    const src = solid(1, 1, [10, 20, 30, 255]);
    applyAdjustments(src, adjust({ brightness: 50 }));
    expect([...src.data]).toEqual([10, 20, 30, 255]);
  });
});
