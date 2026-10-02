import { describe, expect, it } from "vitest";
import { baseSettings } from "../defaults";
import { toSvg, upscaleNearest } from "../export";
import { extractPalette, PALETTE_PRESETS } from "../palettes";
import { processImage } from "../pipeline";
import { computeOutputSize, MAX_DIMENSION, resample } from "../resize";
import type { PixelBuffer } from "../types";
import { gradient, solid, uniqueColors } from "./helpers";

describe("computeOutputSize", () => {
  it("scale mode", () => {
    expect(computeOutputSize(1000, 500, { mode: "scale", scale: 25, width: 0, height: 0, filter: "area" })).toEqual({
      width: 250,
      height: 125,
    });
  });

  it("width mode keeps aspect", () => {
    expect(computeOutputSize(1000, 500, { mode: "width", scale: 0, width: 320, height: 0, filter: "area" })).toEqual({
      width: 320,
      height: 160,
    });
  });

  it("height mode keeps aspect", () => {
    expect(computeOutputSize(1000, 500, { mode: "height", scale: 0, width: 0, height: 100, filter: "area" })).toEqual({
      width: 200,
      height: 100,
    });
  });

  it("never returns zero and caps huge sizes", () => {
    expect(computeOutputSize(1000, 10, { mode: "width", scale: 0, width: 10, height: 0, filter: "area" })).toEqual({
      width: 10,
      height: 1,
    });
    const big = computeOutputSize(1000, 500, { mode: "width", scale: 0, width: 100000, height: 0, filter: "area" });
    expect(big.width).toBe(MAX_DIMENSION);
    expect(big.height).toBe(MAX_DIMENSION / 2);
  });
});

describe("resample", () => {
  it("averages areas when downscaling", () => {
    const src: PixelBuffer = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    };
    expect([...resample(src, 1, 1).data]).toEqual([128, 128, 128, 255]);
  });

  it("ignores colour of fully transparent pixels", () => {
    const src: PixelBuffer = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]),
    };
    const out = resample(src, 1, 1).data;
    expect(out[0]).toBe(255);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(128);
  });

  it("preserves solid colours at any size", () => {
    const out = resample(solid(7, 5, [10, 20, 30, 255]), 3, 13);
    expect(uniqueColors(out)).toEqual(new Set(["10,20,30"]));
  });
});

describe("upscaleNearest", () => {
  it("repeats each pixel factor×factor times", () => {
    const src: PixelBuffer = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]),
    };
    const out = upscaleNearest(src, 2);
    expect(out.width).toBe(4);
    expect(out.height).toBe(2);
    expect([...out.data.slice(0, 16)]).toEqual([1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 255, 4, 5, 6, 255]);
    expect([...out.data.slice(16)]).toEqual([...out.data.slice(0, 16)]);
  });
});

describe("toSvg", () => {
  it("merges runs into one path per colour and skips transparency", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255,
      0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
    const svg = toSvg({ width: 3, height: 2, data }, 4);
    expect(svg).toContain('width="12" height="8" viewBox="0 0 3 2"');
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('<path fill="#000000" d="M0 0h2v1h-2z"/>');
    expect(svg).toContain('<path fill="#ffffff" d="M2 0h1v1h-1zM1 1h2v1h-2z"/>');
  });

  it("produces parseable XML", () => {
    const out = processImage(gradient(40, 10), baseSettings());
    const doc = new DOMParser().parseFromString(toSvg(out), "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe("svg");
  });
});

describe("palettes", () => {
  it("all presets have unique ids and valid colours", () => {
    const ids = new Set(PALETTE_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(PALETTE_PRESETS.length);
    for (const p of PALETTE_PRESETS) {
      expect(p.colors.length).toBeGreaterThanOrEqual(2);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("extractPalette finds the dominant colours", () => {
    const data = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) data.set(i < 50 ? [250, 10, 10, 255] : [10, 10, 250, 255], i * 4);
    const colors = extractPalette({ width: 100, height: 1, data }, 2);
    expect(colors.sort()).toEqual(["#0a0afa", "#fa0a0a"]);
  });

  it("extractPalette never returns more colours than exist", () => {
    expect(extractPalette(solid(10, 10, [1, 2, 3, 255]), 8)).toEqual(["#010203"]);
  });
});

describe("processImage", () => {
  it("resizes then dithers into the chosen palette", () => {
    const settings = baseSettings();
    settings.resize = { mode: "width", width: 20, height: 0, scale: 0, filter: "area" };
    const out = processImage(gradient(80, 40), settings);
    expect(out.width).toBe(20);
    expect(out.height).toBe(10);
    expect(uniqueColors(out)).toEqual(new Set(["9,9,11", "250,250,250"]));
  });
});
