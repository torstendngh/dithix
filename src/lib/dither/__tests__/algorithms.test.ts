import { describe, expect, it } from "vitest";
import { ALGORITHMS, DIFFUSION_KERNELS, dither, hilbertD2xy } from "../algorithms";
import { PaletteMatcher } from "../color";
import { baseSettings } from "../defaults";
import type { AlgorithmId, DitherOptions } from "../types";
import { gradient, meanLuma, solid, uniqueColors } from "./helpers";

const bw = () => new PaletteMatcher([[0, 0, 0], [255, 255, 255]]);
const opts = (algorithm: AlgorithmId, extra: Partial<DitherOptions> = {}): DitherOptions => ({
  ...baseSettings().dither,
  algorithm,
  ...extra,
});

describe("dither", () => {
  it.each(ALGORITHMS.map((a) => a.id))("%s only emits palette colours", (id) => {
    const out = dither(gradient(64, 16), opts(id), bw());
    const colors = uniqueColors(out);
    for (const c of colors) expect(["0,0,0", "255,255,255"]).toContain(c);
  });

  it.each(ALGORITHMS.filter((a) => a.kind !== "threshold").map((a) => a.id))(
    "%s roughly preserves mean brightness of a gradient",
    (id) => {
      const src = gradient(128, 32);
      const out = dither(src, opts(id), bw());
      // Atkinson loses 1/4 of the error by design, so allow more slack.
      const tolerance = id === "atkinson" ? 24 : 14;
      expect(Math.abs(meanLuma(out) - meanLuma(src))).toBeLessThan(tolerance);
    },
  );

  it("Bayer 2×2 turns 50% grey into a checkerboard", () => {
    const out = dither(solid(4, 4, [128, 128, 128, 255]), opts("bayer2"), bw());
    const px = (x: number, y: number) => out.data[(y * 4 + x) * 4];
    expect(px(0, 0)).toBe(px(1, 1));
    expect(px(1, 0)).toBe(px(0, 1));
    expect(px(0, 0)).not.toBe(px(1, 0));
  });

  it.each([2, 4, 8, 16])("Bayer %i reproduces every grey level within one step", (n) => {
    const out = dither(gradient(256, n), opts(`bayer${n}` as AlgorithmId), bw());
    // Check average over each tile-aligned block matches the source level.
    for (let x0 = 0; x0 + n <= 256; x0 += n * 4) {
      let sum = 0;
      for (let y = 0; y < n; y++) for (let x = x0; x < x0 + n; x++) sum += out.data[(y * 256 + x) * 4];
      const mean = sum / (n * n);
      const expected = ((x0 + (n - 1) / 2) / 255) * 255;
      expect(Math.abs(mean - expected)).toBeLessThanOrEqual(255 / (n * n) + 255 / 64);
    }
  });

  it("threshold maps solid colours to the nearest palette entry", () => {
    const out = dither(solid(2, 2, [100, 100, 100, 255]), opts("threshold"), bw());
    expect([...uniqueColors(out)]).toEqual(["0,0,0"]);
  });

  it("strength 0 for ordered behaves like threshold", () => {
    const src = gradient(32, 4);
    expect(dither(src, opts("bayer8", { strength: 0 }), bw()).data).toEqual(
      dither(src, opts("threshold"), bw()).data,
    );
  });

  it("keeps transparent pixels transparent", () => {
    const out = dither(solid(3, 3, [200, 200, 200, 0]), opts("floyd-steinberg"), bw());
    expect(out.data.every((v) => v === 0)).toBe(true);
  });

  it("white noise is deterministic per seed and differs across seeds", () => {
    const src = gradient(32, 8);
    const a = dither(src, opts("white-noise", { seed: 1 }), bw()).data;
    const b = dither(src, opts("white-noise", { seed: 1 }), bw()).data;
    const c = dither(src, opts("white-noise", { seed: 2 }), bw()).data;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("serpentine changes diffusion output", () => {
    const src = gradient(32, 8);
    const a = dither(src, opts("floyd-steinberg", { serpentine: true }), bw()).data;
    const b = dither(src, opts("floyd-steinberg", { serpentine: false }), bw()).data;
    expect(a).not.toEqual(b);
  });

  it("works with multi-colour palettes", () => {
    const gb = new PaletteMatcher([[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]]);
    const out = dither(gradient(64, 8), opts("atkinson"), gb);
    expect(uniqueColors(out).size).toBeGreaterThan(2);
  });
});

describe("diffusion kernels", () => {
  it.each(Object.entries(DIFFUSION_KERNELS).filter(([id]) => id !== "atkinson"))(
    "%s weights sum to the divisor",
    (_, k) => {
      expect(k.taps.reduce((s, t) => s + t[2], 0)).toBe(k.divisor);
    },
  );

  it("only ever pushes error forward", () => {
    for (const k of Object.values(DIFFUSION_KERNELS)) {
      for (const [dx, dy] of k.taps) expect(dy > 0 || (dy === 0 && dx > 0)).toBe(true);
    }
  });
});

describe("hilbertD2xy", () => {
  it("visits every cell of the grid exactly once with unit steps", () => {
    const n = 8;
    const seen = new Set<string>();
    let prev = hilbertD2xy(n, 0);
    seen.add(prev.join());
    for (let d = 1; d < n * n; d++) {
      const p = hilbertD2xy(n, d);
      expect(Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1])).toBe(1);
      seen.add(p.join());
      prev = p;
    }
    expect(seen.size).toBe(n * n);
  });
});
