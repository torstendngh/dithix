import { describe, expect, it } from "vitest";
import { fitAspect, isFullCrop, MIN_CROP, moveCrop, normalizedAspect, resizeCrop } from "../crop-math";
import type { CropRect } from "../dither/types";

const r = (x: number, y: number, width: number, height: number): CropRect => ({ x, y, width, height });
const close = (a: CropRect, b: CropRect) => {
  for (const k of ["x", "y", "width", "height"] as const) expect(a[k], k).toBeCloseTo(b[k], 6);
};
const inside = (c: CropRect) => {
  expect(c.x).toBeGreaterThanOrEqual(-1e-9);
  expect(c.y).toBeGreaterThanOrEqual(-1e-9);
  expect(c.x + c.width).toBeLessThanOrEqual(1 + 1e-9);
  expect(c.y + c.height).toBeLessThanOrEqual(1 + 1e-9);
};

describe("crop math", () => {
  it("moves within the image", () => {
    close(moveCrop(r(0.2, 0.2, 0.5, 0.5), 0.1, -0.1), r(0.3, 0.1, 0.5, 0.5));
    close(moveCrop(r(0.2, 0.2, 0.5, 0.5), 5, -5), r(0.5, 0, 0.5, 0.5));
  });

  it("resizes freely from each handle, clamped and never below the minimum", () => {
    close(resizeCrop(r(0.2, 0.2, 0.5, 0.5), "se", 0.1, 0.2), r(0.2, 0.2, 0.6, 0.7));
    close(resizeCrop(r(0.2, 0.2, 0.5, 0.5), "nw", -0.5, -0.5), r(0, 0, 0.7, 0.7));
    close(resizeCrop(r(0.2, 0.2, 0.5, 0.5), "e", -1, 0), r(0.2, 0.2, MIN_CROP, 0.5));
    close(resizeCrop(r(0.2, 0.2, 0.5, 0.5), "n", 0, 0.1), r(0.2, 0.3, 0.5, 0.4));
  });

  it("keeps a locked shape and fits it into the room left", () => {
    for (const handle of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const) {
      const out = resizeCrop(r(0.3, 0.3, 0.4, 0.4), handle, 0.5, 0.5, 1);
      expect(out.width / out.height, handle).toBeCloseTo(1, 6);
      inside(out);
    }
    // Dragging the SE corner out keeps the NW corner anchored.
    const se = resizeCrop(r(0.1, 0.1, 0.2, 0.2), "se", 0.2, 0.05, 1);
    close(se, r(0.1, 0.1, 0.4, 0.4));
  });

  it("fits a shape around the current centre", () => {
    close(fitAspect(r(0, 0, 1, 1), 1), r(0, 0, 1, 1));
    const wide = fitAspect(r(0.4, 0.4, 0.2, 0.2), 2); // normalised 2:1
    close(wide, r(0, 0.25, 1, 0.5));
    inside(fitAspect(r(0.9, 0.9, 0.1, 0.1), 0.5));
  });

  it("converts pixel aspects for non-square images", () => {
    expect(normalizedAspect(1, 200, 100)).toBeCloseTo(0.5);
    expect(normalizedAspect(0, 200, 100)).toBe(0);
    expect(isFullCrop(r(0, 0, 1, 1))).toBe(true);
    expect(isFullCrop(r(0, 0, 0.9, 1))).toBe(false);
  });
});
