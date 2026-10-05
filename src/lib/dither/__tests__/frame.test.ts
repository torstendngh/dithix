import { describe, expect, it } from "vitest";
import { baseSettings } from "../defaults";
import { cropRegion, extractRegion, frameLayout, framedResampler, FULL_CROP, padBuffer } from "../frame";
import { processImage } from "../pipeline";
import { resample } from "../resize";
import type { PixelBuffer } from "../types";
import { solid } from "./helpers";

/** Left half red, right half blue. */
function halves(w: number, h: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(x < w / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}

const scale100 = { mode: "scale" as const, scale: 100, width: 0, height: 0, filter: "area" as const };

describe("cropRegion", () => {
  it("maps the normalised crop to whole source pixels", () => {
    expect(cropRegion(200, 100, { x: 0.25, y: 0.5, width: 0.5, height: 0.5 })).toEqual({ x: 50, y: 50, width: 100, height: 50 });
    expect(cropRegion(200, 100)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("stays inside the image and never collapses", () => {
    expect(cropRegion(10, 10, { x: 0.95, y: -1, width: 0.5, height: 0 })).toEqual({ x: 9, y: 0, width: 1, height: 1 });
  });
});

describe("frameLayout", () => {
  it("resizes the cropped region and adds the margin on every side", () => {
    const layout = frameLayout(400, 200, { ...scale100, mode: "width", width: 100 }, { x: 0, y: 0, width: 0.5, height: 1 }, 10);
    expect(layout.region).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(layout.inner).toEqual({ width: 100, height: 100 });
    expect([layout.width, layout.height, layout.padding]).toEqual([120, 120, 10]);
  });

  it("ignores negative or silly padding", () => {
    expect(frameLayout(10, 10, scale100, FULL_CROP, -5).padding).toBe(0);
    expect(frameLayout(10, 10, scale100, FULL_CROP, 99999).padding).toBe(512);
  });
});

describe("buffers", () => {
  it("extractRegion copies just the region (or returns the source when it is all of it)", () => {
    const src = halves(4, 2);
    expect(extractRegion(src, { x: 0, y: 0, width: 4, height: 2 })).toBe(src);
    const right = extractRegion(src, { x: 2, y: 0, width: 2, height: 2 });
    expect([right.width, right.height, right.data[0], right.data[2]]).toEqual([2, 2, 0, 255]);
  });

  it("padBuffer centres the image on a transparent canvas", () => {
    const out = padBuffer(solid(2, 2, [9, 9, 9, 255]), 1, 1, 4, 4);
    const alpha = (x: number, y: number) => out.data[(y * 4 + x) * 4 + 3];
    expect([alpha(0, 0), alpha(1, 1), alpha(2, 2), alpha(3, 3)]).toEqual([0, 255, 255, 0]);
  });

  it("framed resampler keeps the margin in proportion at smaller sizes", () => {
    const src = solid(40, 40, [255, 255, 255, 255]);
    const layout = frameLayout(40, 40, scale100, FULL_CROP, 10); // 60×60, margin 10
    const frame = framedResampler((w, h) => resample(src, w, h), layout);
    const half = frame(30, 30); // margin should be 5
    const alpha = (x: number) => half.data[(15 * 30 + x) * 4 + 3];
    expect([alpha(4), alpha(5), alpha(24), alpha(25)]).toEqual([0, 255, 255, 0]);
  });
});

describe("processImage with crop and margin", () => {
  it("only the cropped part reaches the output", () => {
    const settings = baseSettings();
    settings.resize = scale100;
    settings.palette = { presetId: null, colors: ["#ff0000", "#0000ff"], distance: "rgb" };
    const out = processImage(halves(20, 10), settings, { x: 0.5, y: 0, width: 0.5, height: 1 });
    expect([out.width, out.height]).toEqual([10, 10]);
    for (let i = 0; i < out.data.length; i += 4) expect(out.data[i + 2]).toBe(255); // all blue
  });

  it("the margin is transparent without a background and filled with one", () => {
    const settings = baseSettings();
    settings.resize = scale100;
    settings.background = { ...settings.background, padding: 3 };
    const plain = processImage(solid(10, 10, [255, 255, 255, 255]), settings);
    expect([plain.width, plain.height]).toEqual([16, 16]);
    expect(plain.data[3]).toBe(0);
    expect(plain.data[(8 * 16 + 8) * 4 + 3]).toBe(255);

    settings.background = { ...settings.background, enabled: true, mode: "solid", colorA: "#000000" };
    const filled = processImage(solid(10, 10, [255, 255, 255, 255]), settings);
    expect([...filled.data.slice(0, 4)]).toEqual([9, 9, 11, 255]); // zinc's dark colour
  });
});
