import { describe, expect, it } from "vitest";
import { BACKGROUND_MODES, defaultPattern, fillBackground, normalizePattern, patternFromMatrix, resizePattern } from "../background";
import { bayerMatrix } from "../matrices";
import { baseSettings, completeSettings } from "../defaults";
import { getPalettePreset } from "../palettes";
import { applyFilters, boxBlur, defaultParams, FILTERS, getFilter, normalizeFilters, sortPixels } from "../filters";
import { processImage } from "../pipeline";
import type { FilterInstance, PixelBuffer } from "../types";
import { gradient, solid } from "./helpers";

/** Colourful, textured test image. */
function textured(w: number, h: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data.set([(x * 7 + y * 3) % 256, (x * x + y * 11) % 256, (y * 9) % 256, 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

const inst = (type: string, params: Record<string, number> = {}): FilterInstance => ({
  id: type,
  type,
  enabled: true,
  params: { ...defaultParams(getFilter(type)!), ...params },
});

describe("filter registry", () => {
  it("has unique types and sane param defaults", () => {
    expect(new Set(FILTERS.map((f) => f.type)).size).toBe(FILTERS.length);
    for (const f of FILTERS) {
      for (const p of f.params) {
        expect(p.default, `${f.type}.${p.key}`).toBeGreaterThanOrEqual(p.min);
        expect(p.default, `${f.type}.${p.key}`).toBeLessThanOrEqual(p.max);
      }
    }
  });

  it.each(FILTERS.map((f) => f.type))("%s keeps the size, is deterministic and does not mutate input", (type) => {
    const src = textured(40, 30);
    const copy = new Uint8ClampedArray(src.data);
    const a = applyFilters(src, [inst(type)]);
    const b = applyFilters(src, [inst(type)]);
    expect([a.width, a.height]).toEqual([40, 30]);
    expect(a.data).toEqual(b.data);
    expect(src.data).toEqual(copy);
  });

  it("disabled filters are skipped", () => {
    const src = textured(20, 20);
    expect(applyFilters(src, [{ ...inst("posterize"), enabled: false }]).data).toEqual(src.data);
  });
});

describe("individual filters", () => {
  const src = textured(48, 32);

  it("no-op at zero strength", () => {
    for (const [type, params] of [
      ["blur", { radius: 0 }],
      ["wave", { amplitude: 0 }],
      ["rgb-split", { offset: 0 }],
      ["vignette", { amount: 0 }],
    ] as const) {
      expect(applyFilters(src, [inst(type, params)]).data, type).toEqual(src.data);
    }
  });

  it("blur keeps a flat image flat and smooths an edge", () => {
    const flat = solid(10, 10, [80, 90, 100, 255]);
    expect(boxBlur(flat, 3).data).toEqual(flat.data);
    const edge = gradient(32, 4);
    const blurred = boxBlur(edge, 4);
    expect(blurred.data[0]).toBeGreaterThan(edge.data[0]);
  });

  it("posterize leaves only the requested number of levels per channel", () => {
    const out = applyFilters(gradient(256, 1), [inst("posterize", { levels: 4 })]);
    const levels = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) levels.add(out.data[i]);
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 85, 170, 255]);
  });

  it("pixel sort orders runs inside the range and leaves the rest", () => {
    const row = [200, 50, 180, 10, 120, 90, 250];
    const data = new Uint8ClampedArray(row.length * 4);
    row.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    const out = sortPixels({ width: row.length, height: 1, data }, false, 40, 220, false);
    const values = Array.from({ length: row.length }, (_, i) => out.data[i * 4]);
    // 10 and 250 are outside the range and stay put; the runs between them are sorted.
    expect(values).toEqual([50, 180, 200, 10, 90, 120, 250]);
  });

  it("rgb split moves red and blue in opposite directions", () => {
    const out = applyFilters(src, [inst("rgb-split", { offset: 3, angle: 0 })]);
    const at = (img: PixelBuffer, x: number, y: number, c: number) => img.data[(y * img.width + x) * 4 + c];
    expect(at(out, 10, 5, 0)).toBe(at(src, 7, 5, 0));
    expect(at(out, 10, 5, 2)).toBe(at(src, 13, 5, 2));
    expect(at(out, 10, 5, 1)).toBe(at(src, 10, 5, 1));
  });

  it("slice shift moves whole rows sideways, seeded", () => {
    const out = applyFilters(src, [inst("slice-shift", { amount: 50, slices: 8, seed: 3 })]);
    let shiftedRows = 0;
    for (let y = 0; y < src.height; y++) {
      const row = (img: PixelBuffer) => img.data.slice(y * img.width * 4, (y + 1) * img.width * 4);
      if (row(out).join() !== row(src).join()) shiftedRows++;
    }
    expect(shiftedRows).toBeGreaterThan(0);
    expect(applyFilters(src, [inst("slice-shift", { amount: 50, slices: 8, seed: 4 })]).data).not.toEqual(out.data);
  });

  it("swirl and bulge leave pixels outside their radius alone", () => {
    for (const type of ["swirl", "bulge"]) {
      const out = applyFilters(src, [inst(type, { radius: 30 })]);
      expect(out.data.slice(0, 4), type).toEqual(src.data.slice(0, 4)); // corner
    }
  });

  it("TV glitch with everything at zero leaves the image alone", () => {
    const out = applyFilters(src, [inst("tv-glitch", { wobble: 0, tracking: 0, chroma: 0, noise: 0 })]);
    for (let i = 0; i < src.data.length; i++) expect(Math.abs(out.data[i] - src.data[i])).toBeLessThanOrEqual(1);
  });

  it("TV glitch tears rows sideways, mostly around the tracking band, and is seeded", () => {
    const img = textured(80, 100);
    const p = { wobble: 0, tracking: 100, position: 50, chroma: 0, noise: 0 };
    const out = applyFilters(img, [inst("tv-glitch", p)]);
    const rowChanged = (y: number) =>
      out.data.slice(y * 80 * 4, (y + 1) * 80 * 4).join() !== img.data.slice(y * 80 * 4, (y + 1) * 80 * 4).join();
    expect(rowChanged(50)).toBe(true);
    expect(rowChanged(5)).toBe(false);
    expect(rowChanged(95)).toBe(false);
    expect(applyFilters(img, [inst("tv-glitch", { ...p, seed: 2 })]).data).not.toEqual(out.data);
  });

  it("filters run at band scale inside the glitch gradient", () => {
    const settings = baseSettings();
    settings.resize = { ...settings.resize, mode: "width", width: 48 };
    settings.filters = [
      inst("wave", { amplitude: 6 }),
      inst("glitch-gradient", { startSize: 1, endSize: 6, scatter: 0 }),
      inst("slice-shift"),
    ];
    const out = processImage(src, settings);
    expect([out.width, out.height]).toEqual([48, 32]);
  });
});

describe("normalizeFilters", () => {
  it("drops unknown types, clamps params and fills defaults", () => {
    const result = normalizeFilters([
      { id: "a", type: "blur", enabled: true, params: { radius: 999 } },
      { id: "b", type: "does-not-exist", params: {} },
      { type: "posterize" },
      "junk",
      null,
    ]);
    expect(result.map((f) => f.type)).toEqual(["blur", "posterize"]);
    expect(result[0].params.radius).toBe(20);
    expect(result[1]).toMatchObject({ enabled: true, params: { levels: 4 } });
    expect(typeof result[1].id).toBe("string");
  });

  it("returns [] for anything that isn't a list", () => {
    expect(normalizeFilters({ type: "blur" })).toEqual([]);
  });
});

describe("fillBackground", () => {
  const transparentHalf = () => {
    const img = solid(16, 16, [200, 0, 0, 255]);
    for (let i = 0; i < img.data.length / 2; i += 4) img.data[i + 3] = 0; // top half transparent
    return img;
  };

  it("is a no-op when off", () => {
    const img = transparentHalf();
    expect(fillBackground(img, { enabled: false, mode: "solid", colorA: "#000000", colorB: "#ffffff", size: 4, pattern: defaultPattern() })).toBe(img);
  });

  it("fills only transparent pixels and makes the result opaque", () => {
    const out = fillBackground(transparentHalf(), { enabled: true, mode: "solid", colorA: "#0000ff", colorB: "#ffffff", size: 4, pattern: defaultPattern() });
    expect([...out.data.slice(0, 4)]).toEqual([0, 0, 255, 255]);
    const bottom = out.data.length - 4;
    expect([...out.data.slice(bottom, bottom + 4)]).toEqual([200, 0, 0, 255]);
  });

  it.each(BACKGROUND_MODES.filter((m) => !["solid", "gradient"].includes(m.value)).map((m) => m.value))(
    "%s pattern uses both colours",
    (mode) => {
      const empty = solid(32, 32, [0, 0, 0, 0]);
      const out = fillBackground(empty, { enabled: true, mode, colorA: "#000000", colorB: "#ffffff", size: 8, pattern: defaultPattern() });
      const values = new Set<number>();
      for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i]);
      expect(values).toEqual(new Set([0, 255]));
    },
  );
});

describe("default background survives dithering", () => {
  it.each([
    ["Zinc (2 colours)", "zinc"],
    ["Sweetie 16", "sweetie16"],
  ])("checker is still visible with %s", (_, paletteId) => {
    const settings = baseSettings();
    const palette = getPalettePreset(paletteId)!;
    settings.palette = { ...settings.palette, presetId: palette.id, colors: [...palette.colors] };
    settings.resize = { ...settings.resize, mode: "scale", scale: 100 };
    settings.background = { ...settings.background, enabled: true, mode: "checker" };
    const out = processImage(solid(64, 64, [0, 0, 0, 0]), settings);
    const colors = new Set<string>();
    for (let i = 0; i < out.data.length; i += 4) colors.add(`${out.data[i]},${out.data[i + 1]},${out.data[i + 2]}`);
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("legacy background", () => {
  it("turns the old transparent mode into a switched-off background", () => {
    const bg = (mode: string) => completeSettings({ background: { mode, colorA: "#123456" } }).background;
    expect(bg("transparent")).toMatchObject({ enabled: false, mode: "solid", colorA: "#123456" });
    expect(bg("checker")).toMatchObject({ enabled: true, mode: "checker" });
    expect(completeSettings({ background: { enabled: false, mode: "dots" } }).background).toMatchObject({ enabled: false, mode: "dots" });
  });
});

describe("custom background pattern", () => {
  const bg = (pattern: ReturnType<typeof defaultPattern>) =>
    ({ enabled: true, mode: "pattern", colorA: "#000000", colorB: "#ffffff", size: 8, pattern }) as const;

  it("tiles the drawn cells at the given pixel scale", () => {
    const pattern = { size: 2, cells: "1000", scale: 2 };
    const out = fillBackground(solid(8, 8, [0, 0, 0, 0]), bg(pattern));
    const at = (x: number, y: number) => out.data[(y * 8 + x) * 4];
    expect([at(0, 0), at(1, 1), at(2, 0), at(0, 2), at(4, 4), at(5, 5)]).toEqual([255, 255, 0, 0, 255, 255]);
  });

  it("builds Bayer presets by density", () => {
    expect(patternFromMatrix(bayerMatrix(2), 0.25).cells).toBe("1000");
    expect(patternFromMatrix(bayerMatrix(2), 0.75).cells).toBe("1101");
    expect(patternFromMatrix(bayerMatrix(4), 0).cells).toBe("0".repeat(16));
    expect(patternFromMatrix(bayerMatrix(8), 1).cells).toBe("1".repeat(64));
  });

  it("repeats the tile when resized", () => {
    expect(resizePattern({ size: 2, cells: "1001", scale: 1 }, 4).cells).toBe("1010010110100101");
  });

  it("falls back to the default tile when malformed, keeping a valid scale", () => {
    expect(normalizePattern({ size: 3, cells: "101", scale: 4 })).toEqual({ ...defaultPattern(), scale: 4 });
    expect(normalizePattern({ size: 2, cells: "10x1", scale: 1 })).toEqual(defaultPattern());
    expect(normalizePattern({ size: 2, cells: "1001", scale: 99 })).toEqual({ size: 2, cells: "1001", scale: 16 });
  });

  it("survives dithering when its colours are in the palette", () => {
    const settings = baseSettings(); // zinc: #09090b / #fafafa
    settings.resize = { ...settings.resize, mode: "scale", scale: 100 };
    settings.background = { ...bg({ size: 2, cells: "1000", scale: 1 }), colorA: "#09090b", colorB: "#fafafa" };
    const out = processImage(solid(8, 8, [0, 0, 0, 0]), settings);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) expect(out.data[(y * 8 + x) * 4], `${x},${y}`).toBe(x % 2 === 0 && y % 2 === 0 ? 250 : 9);
    }
  });
});
