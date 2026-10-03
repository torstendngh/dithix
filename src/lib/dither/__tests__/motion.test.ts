import { describe, expect, it } from "vitest";
import { baseSettings, completeSettings } from "../defaults";
import { defaultParams, getFilter } from "../filters";
import { crawlOffset, frameCount, settingsAtFrame } from "../motion";
import { processImage } from "../pipeline";
import type { DitherSettings, FilterInstance } from "../types";
import { gradient } from "./helpers";

const inst = (type: string, params: Record<string, number> = {}): FilterInstance => ({
  id: type,
  type,
  enabled: true,
  params: { ...defaultParams(getFilter(type)!), ...params },
});

const moving = (patch: Partial<DitherSettings["motion"]> = {}): DitherSettings => {
  const s = baseSettings();
  s.motion = { ...s.motion, enabled: true, crawl: 0, ...patch };
  return s;
};

describe("frameCount", () => {
  it("is duration × fps, at least 2 and capped", () => {
    expect(frameCount({ duration: 2, fps: 12 })).toBe(24);
    expect(frameCount({ duration: 0.01, fps: 8 })).toBe(2);
    expect(frameCount({ duration: 60, fps: 30 })).toBe(300);
  });
});

describe("settingsAtFrame", () => {
  it("frame 0 is the still", () => {
    const s = moving({ crawl: 2, hueTurns: 1, pulse: 30, boil: 1 });
    s.filters = [inst("wave"), inst("tv-glitch"), inst("grain")];
    expect(settingsAtFrame(s, 0, 24)).toEqual(s);
  });

  it("does not modify its input", () => {
    const s = moving({ hueTurns: 1 });
    const copy = structuredClone(s);
    settingsAtFrame(s, 5, 24);
    expect(s).toEqual(copy);
  });

  it("cycles hue by whole turns and pulses brightness", () => {
    const s = moving({ hueTurns: 1, pulse: 40 });
    expect(settingsAtFrame(s, 6, 24).adjust).toMatchObject({ hue: 90, brightness: 40 }); // quarter loop
    expect(settingsAtFrame(s, 12, 24).adjust.hue).toBe(-180);
    expect(settingsAtFrame(s, 18, 24).adjust.brightness).toBeCloseTo(-40);
  });

  it("boil holds each seed for N frames", () => {
    const s = moving({ boil: 2 });
    s.filters = [inst("grain", { seed: 5 })];
    const seeds = [0, 1, 2, 3, 4].map((i) => settingsAtFrame(s, i, 24));
    expect(seeds.map((f) => f.dither.seed)).toEqual([1, 1, seeds[2].dither.seed, seeds[2].dither.seed, seeds[4].dither.seed]);
    expect(seeds[2].dither.seed).not.toBe(1);
    expect(seeds[2].filters[0].params.seed).not.toBe(5);
  });

  it("animates filter phases inside their ranges", () => {
    const s = moving();
    s.filters = [inst("wave", { phase: 300 }), inst("tv-glitch", { position: 90 }), inst("swirl", { angle: 200 })];
    const half = settingsAtFrame(s, 12, 24).filters;
    expect(half[0].params.phase).toBe(120); // 300 + 180, wrapped
    expect(half[1].params.position).toBe(40); // band rolled half the picture
    expect(half[2].params.angle).toBe(-200);
    s.motion.animateFilters = false;
    expect(settingsAtFrame(s, 12, 24).filters).toEqual(s.filters);
  });
});

describe("crawlOffset", () => {
  it("moves about `crawl` px per frame and closes the loop on a pattern period", () => {
    const m = moving({ crawl: 1 }).motion;
    // Bayer 4×4, 10 frames: 10 px would not loop, so the total snaps to 12 (3 periods).
    const xs = Array.from({ length: 11 }, (_, i) => crawlOffset(m, "bayer4", i, 10)[0]);
    expect(xs[10] % 4).toBe(0);
    for (let i = 1; i < 11; i++) expect(Math.abs(xs[i] - xs[i - 1]) % 63).toBeLessThanOrEqual(2);
  });

  it("does nothing for error diffusion or when off", () => {
    expect(crawlOffset(moving({ crawl: 2 }).motion, "floyd-steinberg", 3, 10)).toEqual([0, 0]);
    expect(crawlOffset(moving({ crawl: 0 }).motion, "bayer8", 3, 10)).toEqual([0, 0]);
  });

  it("shifts the rendered pattern", () => {
    const src = gradient(32, 8);
    const s = moving({ crawl: 1 });
    s.resize = { ...s.resize, mode: "scale", scale: 100 };
    const a = processImage(src, settingsAtFrame(s, 0, 8));
    const b = processImage(src, settingsAtFrame(s, 1, 8));
    expect(b.data).not.toEqual(a.data);
  });
});

describe("motion settings", () => {
  it("default off and fill in for older saves", () => {
    expect(baseSettings().motion.enabled).toBe(false);
    expect(completeSettings({ dither: { algorithm: "bayer8" } }).motion).toEqual(baseSettings().motion);
  });

  it("per-frame offsets never leak into stored settings", () => {
    const s = moving({ crawl: 1 });
    expect(completeSettings(settingsAtFrame(s, 3, 24)).dither).not.toHaveProperty("offsetX");
  });
});
