import { identityCurves } from "./adjust";
import { getPalettePreset } from "./palettes";
import { mergeDefaults } from "../merge-defaults";
import type { DitherSettings, ExportSettings } from "./types";

/** Neutral starting point; built-in presets are defined as changes on top of this. */
export function baseSettings(): DitherSettings {
  return {
    resize: { mode: "width", scale: 50, width: 320, height: 240, filter: "area" },
    adjust: {
      brightness: 0,
      contrast: 0,
      gamma: 1,
      saturation: 0,
      invert: false,
      curves: identityCurves(),
    },
    dither: {
      algorithm: "bayer4",
      strength: 1,
      spreadMode: "auto",
      spread: 64,
      bias: 0,
      transpose: false,
      serpentine: true,
      seed: 1,
    },
    palette: { presetId: "zinc", colors: [...getPalettePreset("zinc")!.colors], distance: "rgb" },
    gradient: {
      enabled: false,
      direction: "right",
      startSize: 1,
      endSize: 8,
      bands: 6,
      from: 0,
      to: 1,
      fadeIn: false,
      scatter: 0.35,
      seed: 1,
    },
  };
}

/**
 * The official "dithix" look (originally the "deepslate" preset): Zinc Mint, Bayer 8×8 with a
 * fixed 64 spread, 256px tall. Offered as a preset; the app itself starts neutral.
 */
const OFFICIAL: DitherSettings = {
  resize: { mode: "height", scale: 36, width: 512, height: 256, filter: "area" },
  adjust: {
    brightness: 0,
    contrast: 10,
    gamma: 1,
    saturation: 0,
    invert: false,
    curves: {
      master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      r: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      g: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      b: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  dither: {
    algorithm: "bayer8",
    strength: 1,
    spreadMode: "fixed",
    spread: 64,
    bias: 0,
    transpose: false,
    serpentine: true,
    seed: 1,
  },
  palette: {
    presetId: "zinc-mint",
    colors: ["#27272a", "#3f3f46", "#52525b", "#60ffd3", "#18181b"],
    distance: "rgb",
  },
  gradient: {
    enabled: false,
    direction: "right",
    startSize: 1,
    endSize: 8,
    bands: 6,
    from: 0,
    to: 1,
    // Deepslate had this on, but the gradient is off there; kept off so it matches the
    // "fade defaults to off" behaviour when someone enables the gradient.
    fadeIn: false,
    scatter: 0.35,
    seed: 1,
  },
};

export function officialSettings(): DitherSettings {
  return structuredClone(OFFICIAL);
}

/** What the app loads with (and resets to): the neutral base with Sweetie 16, no preset applied. */
export function defaultSettings(): DitherSettings {
  const settings = baseSettings();
  settings.palette.presetId = "sweetie16";
  settings.palette.colors = [...getPalettePreset("sweetie16")!.colors];
  return settings;
}

export function defaultExportSettings(): ExportSettings {
  return { format: "png", scale: 4, quality: 0.92 };
}

/** Settings fields where `null` is a real value rather than corruption. */
const NULLABLE_SETTINGS = new Set(["palette.presetId"]);

/**
 * Normalises stored or preset settings: fills fields added since they were saved from the
 * neutral base and drops corrupt values, while keeping legitimate nulls.
 */
export function completeSettings(raw: unknown): DitherSettings {
  return mergeDefaults(baseSettings(), raw, NULLABLE_SETTINGS);
}
