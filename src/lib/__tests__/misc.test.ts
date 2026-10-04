import { describe, expect, it } from "vitest";
import { gridToRuns, ICONS, rotateGrid } from "@/components/icons/pixel-icons";
import {
  hitCurvePoint,
  histogram,
  insertCurvePoint,
  moveCurvePoint,
  removeCurvePoint,
} from "@/lib/dither/curve-edit";
import { deepEqual } from "@/lib/deep-equal";
import { exportFileName, maxExportScale } from "@/lib/image-io";
import { mergeDefaults } from "@/lib/merge-defaults";

const line = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

describe("curve editing", () => {
  it("inserts in order and rejects duplicate x", () => {
    const { points, index } = insertCurvePoint(line, { x: 100.4, y: 300 });
    expect(index).toBe(1);
    expect(points[1]).toEqual({ x: 100, y: 255 });
    expect(insertCurvePoint(points, { x: 100, y: 5 }).index).toBe(-1);
  });

  it("keeps moved points between neighbours", () => {
    const pts = insertCurvePoint(line, { x: 128, y: 128 }).points;
    expect(moveCurvePoint(pts, 1, 999, 40)[1]).toEqual({ x: 254, y: 40 });
    expect(moveCurvePoint(pts, 1, -5, -5)[1]).toEqual({ x: 1, y: 0 });
    expect(moveCurvePoint(pts, 0, 200, 10)[0]).toEqual({ x: 127, y: 10 });
  });

  it("keeps at least two points", () => {
    expect(removeCurvePoint(line, 0)).toBe(line);
    const three = insertCurvePoint(line, { x: 50, y: 50 }).points;
    expect(removeCurvePoint(three, 1)).toEqual(line);
  });

  it("hit-tests within a radius", () => {
    expect(hitCurvePoint(line, 3, 4, 6)).toBe(0);
    expect(hitCurvePoint(line, 128, 0, 6)).toBe(-1);
  });

  it("builds histograms", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0]);
    expect(histogram(data, 0)[255]).toBe(2);
    expect(histogram(data, -1)[76]).toBe(2);
    expect(histogram(data, 1)[0]).toBe(2);
  });
});

describe("mergeDefaults", () => {
  const defaults = { a: 1, b: { c: "x", d: [1, 2] }, e: null as string | null };

  it("fills missing keys and drops wrong types", () => {
    expect(mergeDefaults(defaults, { a: "nope", b: { d: [9] }, extra: 1 })).toEqual({
      a: 1,
      b: { c: "x", d: [9] },
      e: null,
    });
  });

  it("handles garbage input", () => {
    expect(mergeDefaults(defaults, "garbage")).toEqual(defaults);
    expect(mergeDefaults(defaults, undefined)).toEqual(defaults);
  });

  it("keeps null only at paths declared nullable", () => {
    const d = { palette: { presetId: "zinc" as string | null, size: 2 } };
    const nullable = new Set(["palette.presetId"]);
    expect(mergeDefaults(d, { palette: { presetId: null, size: null } }, nullable)).toEqual({
      palette: { presetId: null, size: 2 },
    });
    // Without the declaration a stored null is treated as corrupt.
    expect(mergeDefaults(d, { palette: { presetId: null } }).palette.presetId).toBe("zinc");
  });

  it("allows nullable defaults to take values", () => {
    expect(mergeDefaults(defaults, { e: "set" }).e).toBe("set");
  });
});

describe("deepEqual", () => {
  it("compares structurally", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});

describe("pixel icons", () => {
  it("are all square, 8×8 or 7×7", () => {
    for (const [name, grid] of Object.entries(ICONS)) {
      expect([7, 8], name).toContain(grid.length);
      for (const row of grid) expect(row, name).toHaveLength(grid.length);
    }
  });

  it("merge rows into runs", () => {
    expect(gridToRuns(["#.##", "####"])).toEqual([
      [0, 0, 1],
      [2, 0, 2],
      [0, 1, 4],
    ]);
  });

  it("rotates clockwise", () => {
    expect(rotateGrid(["#.", ".."])).toEqual([".#", ".."]);
    expect(rotateGrid(["#.", ".."], 4)).toEqual(["#.", ".."]);
  });
});

describe("export helpers", () => {
  it("builds file names", () => {
    expect(exportFileName("photo.final.jpeg", "png")).toBe("photo.final-dithix.png");
    expect(exportFileName("", "svg")).toBe("image-dithix.svg");
  });

  it("limits export scale to the canvas size cap", () => {
    expect(maxExportScale(320, 200)).toBe(51);
    expect(maxExportScale(20000, 10)).toBe(1);
  });
});
