import { describe, expect, it } from "vitest";
import {
  clampView,
  fitZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  wheelZoomFactor,
  zoomAround,
} from "../viewport-math";

describe("viewport math", () => {
  it("fits to whole multiples when enlarging and exact values when shrinking", () => {
    expect(fitZoom({ width: 100, height: 100 }, { width: 500, height: 400 })).toBe(3);
    expect(fitZoom({ width: 2000, height: 1000 }, { width: 1064, height: 800 })).toBeCloseTo(0.5);
    expect(fitZoom({ width: 0, height: 0 }, { width: 500, height: 400 })).toBe(1);
  });

  it("zoomAround keeps the anchor fixed and clamps zoom", () => {
    const v = zoomAround({ zoom: 1, x: 10, y: 0 }, 3, { x: 50, y: 20 });
    // Screen point (50,20) maps to image offset (40,20)/1 before and must map to the same after.
    expect((50 - v.x) / v.zoom).toBeCloseTo(40);
    expect((20 - v.y) / v.zoom).toBeCloseTo(20);
    expect(zoomAround({ zoom: 1, x: 0, y: 0 }, 1e9).zoom).toBe(MAX_ZOOM);
    expect(zoomAround({ zoom: 1, x: 0, y: 0 }, 0).zoom).toBe(MIN_ZOOM);
  });

  it("clamps pans to keep the image reachable", () => {
    const v = clampView({ zoom: 2, x: -5000, y: 5000 }, { width: 100, height: 100 }, { width: 400, height: 300 });
    expect(v).toEqual({ zoom: 2, x: -(200 + 100 - 48), y: 150 + 100 - 48 });
  });

  it("steps through zoom levels from arbitrary values", () => {
    expect(nextZoomStep(1, 1)).toBe(2);
    expect(nextZoomStep(0.7, -1)).toBe(0.5);
    expect(nextZoomStep(100, 1)).toBe(32);
    expect(nextZoomStep(0.01, -1)).toBe(0.25);
  });

  it("wheel up zooms in, down zooms out, and line deltas are scaled", () => {
    expect(wheelZoomFactor(-100, 0, false)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100, 0, false)).toBeLessThan(1);
    expect(wheelZoomFactor(3, 1, false)).toBeCloseTo(wheelZoomFactor(48, 0, false));
    expect(wheelZoomFactor(10, 0, true)).toBeLessThan(wheelZoomFactor(10, 0, false));
  });
});
