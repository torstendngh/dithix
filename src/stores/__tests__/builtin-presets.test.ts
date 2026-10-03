import { describe, expect, it } from "vitest";
import { hexToRgb } from "@/lib/dither/color";
import { baseSettings, completeSettings, defaultSettings, officialSettings } from "@/lib/dither/defaults";
import { gradientFromFilters } from "@/lib/dither/gradient";
import { getPalettePreset } from "@/lib/dither/palettes";
import { processImage } from "@/lib/dither/pipeline";
import { deepEqual } from "@/lib/deep-equal";
import { useSettingsStore } from "../settings-store";
import { BUILTIN_PRESETS } from "../preset-store";

/** Small colourful test image: hue across, brightness down. */
function testImage(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      const v = 1 - y / (height - 1);
      data.set([255 * v * t, 255 * v * (1 - t), 255 * v * (0.5 + 0.5 * Math.sin(t * 6)), 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe("built-in presets", () => {
  it("have unique ids and names, and every one has a group", () => {
    expect(new Set(BUILTIN_PRESETS.map((p) => p.id)).size).toBe(BUILTIN_PRESETS.length);
    expect(new Set(BUILTIN_PRESETS.map((p) => p.name)).size).toBe(BUILTIN_PRESETS.length);
    for (const p of BUILTIN_PRESETS) expect(["official", "classic", "games", "print", "wild", "fx"]).toContain(p.group);
    expect(BUILTIN_PRESETS.filter((p) => p.group === "games").map((p) => p.name)).toContain("Overworld");
    expect(BUILTIN_PRESETS.filter((p) => p.group === "wild").length).toBeGreaterThanOrEqual(6);
  });

  it("only switch on the glitch gradient in Glitch & FX", () => {
    for (const p of BUILTIN_PRESETS) {
      if (p.group !== "fx") expect(gradientFromFilters(p.settings.filters), p.name).toBeNull();
    }
  });

  it("are unchanged by validation, so the picker recognises them once applied", () => {
    for (const p of BUILTIN_PRESETS) expect(completeSettings(structuredClone(p.settings)), p.name).toEqual(p.settings);
  });

  it("use palette colours for pattern backgrounds, so the pattern survives the dither", () => {
    for (const p of BUILTIN_PRESETS) {
      const bg = p.settings.background;
      if (!bg.enabled) continue;
      const colors = p.settings.palette.colors.map((c) => c.toLowerCase());
      expect(colors, p.name).toContain(bg.colorA.toLowerCase());
      if (bg.mode !== "solid") expect(colors, p.name).toContain(bg.colorB.toLowerCase());
    }
  });

  const src = testImage(120, 80);
  it.each(BUILTIN_PRESETS.map((p) => [p.name, p] as const))("%s renders with its own palette", (_, preset) => {
    const out = processImage(src, preset.settings);
    expect(out.width).toBeGreaterThan(0);
    if (gradientFromFilters(preset.settings.filters)?.fadeIn) return; // shows original pixels on purpose
    const allowed = new Set(preset.settings.palette.colors.map((c) => hexToRgb(c).join(",")));
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3] === 0) continue;
      expect(allowed.has(`${out.data[i]},${out.data[i + 1]},${out.data[i + 2]}`)).toBe(true);
    }
  });
});

describe("official dithix preset", () => {
  // The "deepslate" preset as exported from the browser. Its `gradient` section (off) is gone now
  // that the glitch gradient is a filter.
  const deepslate = {
    resize: { mode: "height", scale: 36, width: 512, height: 256, filter: "area" },
    adjust: {
      brightness: 0, contrast: 10, gamma: 1, saturation: 0, hue: 0, invert: false,
      curves: {
        master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
        r: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
        g: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
        b: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      },
    },
    dither: { algorithm: "bayer8", strength: 1, spreadMode: "fixed", spread: 64, bias: 0, transpose: false, serpentine: true, seed: 1 },
    palette: { presetId: "zinc-mint", colors: ["#27272a", "#3f3f46", "#52525b", "#60ffd3", "#18181b"], distance: "rgb" },
    // Added after the export; neutral so the look is unchanged.
    filters: [],
    background: {
      enabled: false, mode: "solid", colorA: "#111111", colorB: "#8a8a8a", size: 8,
      // Bayer 4×4 at 50% is a checkerboard.
      pattern: { size: 4, cells: "1010010110100101", scale: 1 },
    },
  };

  const official = () => BUILTIN_PRESETS.find((p) => p.name === "dithix")!;

  it("exists as the dithix preset under Official, with the deepslate settings", () => {
    expect(BUILTIN_PRESETS[0]).toBe(official());
    expect(official().group).toBe("official");
    expect(official().settings).toEqual(deepslate);
  });

  it("is not the default: the app starts on the neutral base with Sweetie 16", () => {
    const expected = { ...baseSettings(), palette: { ...baseSettings().palette, presetId: "sweetie16", colors: getPalettePreset("sweetie16")!.colors } };
    expect(defaultSettings()).toEqual(expected);
    expect(deepEqual(defaultSettings(), official().settings)).toBe(false);
    useSettingsStore.getState().setDither({ algorithm: "atkinson" });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().settings).toEqual(expected);
  });

  it("starts with no preset active", () => {
    expect(BUILTIN_PRESETS.some((p) => deepEqual(p.settings, defaultSettings()))).toBe(false);
  });

  it("does not leak into other built-ins", () => {
    const classic = BUILTIN_PRESETS.find((p) => p.name === "Classic Bayer")!;
    expect(classic.settings.resize).toEqual(baseSettings().resize);
    expect(classic.settings.dither.spreadMode).toBe("auto");
  });

  it("hands out fresh copies", () => {
    const a = official().settings;
    const before = a.palette.colors.length;
    officialSettings().palette.colors.push("#ffffff");
    expect(officialSettings().palette.colors).toHaveLength(before);
  });
});
