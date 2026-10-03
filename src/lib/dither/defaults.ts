import { identityCurves } from "./adjust";
import { getPalettePreset } from "./palettes";
import { mergeDefaults } from "../merge-defaults";
import { BACKGROUND_MODES, defaultPattern, normalizePattern } from "./background";
import { GLITCH_GRADIENT, normalizeFilters } from "./filters";
import { gradientParams } from "./gradient";
import type { DitherSettings, ExportSettings, GradientSettings } from "./types";

/** Neutral starting point; built-in presets are defined as changes on top of this. */
export function baseSettings(): DitherSettings {
  return {
    resize: { mode: "width", scale: 50, width: 320, height: 240, filter: "area" },
    adjust: {
      brightness: 0,
      contrast: 0,
      gamma: 1,
      saturation: 0,
      hue: 0,
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
    filters: [],
    background: { enabled: false, mode: "solid", colorA: "#111111", colorB: "#8a8a8a", size: 8, pattern: defaultPattern() },
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
    hue: 0,
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
  filters: [],
  background: { enabled: false, mode: "solid", colorA: "#111111", colorB: "#8a8a8a", size: 8, pattern: defaultPattern() },
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
  const settings = mergeDefaults(baseSettings(), raw, NULLABLE_SETTINGS);
  // The glitch gradient used to be its own `gradient` section; carry an enabled one over as a filter.
  const legacy = (raw as { gradient?: Partial<GradientSettings> & { enabled?: unknown } } | null)?.gradient;
  if (legacy?.enabled === true && Array.isArray(settings.filters)) {
    settings.filters = [
      ...settings.filters,
      { id: GLITCH_GRADIENT, type: GLITCH_GRADIENT, enabled: true, params: gradientParams(legacy as GradientSettings) },
    ];
  }
  // Background used to be switched off with a "transparent" mode instead of `enabled`.
  const legacyBg = (raw as { background?: { enabled?: unknown; mode?: unknown } } | null)?.background;
  if (legacyBg && typeof legacyBg.enabled !== "boolean") settings.background.enabled = legacyBg.mode !== "transparent";
  if (!BACKGROUND_MODES.some((m) => m.value === settings.background.mode)) settings.background.mode = "solid";
  settings.background.pattern = normalizePattern(settings.background.pattern);
  // Arrays pass through mergeDefaults untouched; filters need item-level validation (which also
  // fills any gradient params the legacy section was missing).
  settings.filters = normalizeFilters(settings.filters);
  return settings;
}
