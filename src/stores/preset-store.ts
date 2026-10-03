import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { identityCurves } from "@/lib/dither/adjust";
import { baseSettings, completeSettings, officialSettings } from "@/lib/dither/defaults";
import { getPalettePreset } from "@/lib/dither/palettes";
import type { DitherSettings } from "@/lib/dither/types";
import { deepEqual } from "@/lib/deep-equal";
import { newId } from "@/lib/new-id";

export type PresetGroup = "official" | "classic" | "games" | "print" | "wild";

export interface Preset {
  id: string;
  name: string;
  settings: DitherSettings;
  createdAt: number;
  builtIn?: boolean;
  group?: PresetGroup;
}

const builtIn = (
  id: string,
  name: string,
  patch: (s: DitherSettings) => void,
  group: PresetGroup = "classic",
): Preset => {
  const settings = baseSettings();
  patch(settings);
  return { id: `builtin:${id}`, name, settings, createdAt: 0, builtIn: true, group };
};

/** Palette that isn't one of the named palette presets. */
const withColors = (s: DitherSettings, colors: string[]) => {
  s.palette.presetId = null;
  s.palette.colors = colors;
};

const withPalette = (s: DitherSettings, id: string) => {
  s.palette.presetId = id;
  s.palette.colors = [...getPalettePreset(id)!.colors];
};

/**
 * doodad.dev adds `rank / 64 * 64` (0..63) per pixel. With fixed spread 64 our offset is
 * `((rank + 0.5) / 64 - 0.5 + bias) * 64`, so this bias makes the two identical.
 */
export const DOODAD_BIAS_8X8 = 0.5 - 0.5 / 64;

export const BUILTIN_PRESETS: Preset[] = [
  // The house look.
  {
    id: "builtin:dithix",
    name: "dithix",
    settings: officialSettings(),
    createdAt: 0,
    builtIn: true,
    group: "official",
  },
  builtIn("classic-bayer", "Classic Bayer", (s) => {
    s.dither.algorithm = "bayer4";
    withPalette(s, "1bit");
  }),
  // Tuned to match doodad.dev "Dither Me This" ordered 8×8: additive offset of up to 64,
  // transposed Bayer matrix, and the browser's own canvas downscaling.
  builtIn("zinc-mint", "Zinc Mint", (s) => {
    s.resize = { ...s.resize, mode: "height", height: 512, filter: "canvas" };
    s.dither = {
      ...s.dither,
      algorithm: "bayer8",
      spreadMode: "fixed",
      spread: 64,
      bias: DOODAD_BIAS_8X8,
      transpose: true,
    };
    withPalette(s, "zinc-mint");
  }),
  builtIn("game-boy", "Game Boy", (s) => {
    s.resize = { ...s.resize, mode: "width", width: 160 };
    s.dither.algorithm = "bayer4";
    s.adjust.contrast = 15;
    withPalette(s, "gameboy");
  }),
  builtIn("mac-atkinson", "Mac Atkinson", (s) => {
    s.resize = { ...s.resize, mode: "width", width: 512 };
    s.dither.algorithm = "atkinson";
    withPalette(s, "1bit");
  }),
  builtIn("newsprint", "Newsprint", (s) => {
    s.resize = { ...s.resize, mode: "width", width: 480 };
    s.dither.algorithm = "halftone";
    s.adjust.contrast = 20;
    withPalette(s, "obra-dinn");
  }),
  builtIn("pico-8", "PICO-8", (s) => {
    s.resize = { ...s.resize, mode: "width", width: 128 };
    s.dither.algorithm = "bayer8";
    s.dither.strength = 0.6;
    s.palette.distance = "redmean";
    withPalette(s, "pico8");
  }),
  builtIn("amber-crt", "Amber CRT", (s) => {
    s.dither.algorithm = "lines-h";
    s.adjust.curves = identityCurves();
    s.adjust.curves.master = [
      { x: 0, y: 0 },
      { x: 96, y: 64 },
      { x: 255, y: 255 },
    ];
    withPalette(s, "amber");
  }),

  // ── Games ───────────────────────────────────────────────────────────────
  builtIn(
    "overworld",
    "Overworld",
    (s) => {
      // Chunky block textures: stone, dirt, grass, water and sky.
      s.resize = { ...s.resize, mode: "width", width: 128 };
      s.dither.algorithm = "bayer4";
      s.dither.strength = 0.6;
      s.adjust.saturation = 15;
      s.palette.distance = "redmean";
      withColors(s, [
        "#1b1b1b", "#3c3c3c", "#6f6f6f", "#a0a0a0", "#d0d0d0",
        "#4a3220", "#7a5332", "#a67c52",
        "#2f5a1a", "#4e8a2a", "#7cbd3f",
        "#2a4d8f", "#4f7fd6", "#9cc7ff",
      ]);
    },
    "games",
  ),
  builtIn(
    "nether",
    "Nether",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 128 };
      s.dither.algorithm = "bayer4";
      s.dither.strength = 0.7;
      s.adjust.contrast = 15;
      s.palette.distance = "redmean";
      withColors(s, ["#1a0505", "#3d0b0b", "#6e1414", "#a5281b", "#d9471f", "#ff8c1a", "#ffd34d", "#4a2c3a"]);
    },
    "games",
  ),
  builtIn(
    "the-end",
    "The End",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 160 };
      s.dither.algorithm = "bayer8";
      s.adjust.contrast = 10;
      s.palette.distance = "luma";
      withColors(s, ["#0d0b14", "#2a1f3d", "#4b3a6b", "#7b5fa8", "#c9c7a0", "#efeec8"]);
    },
    "games",
  ),
  builtIn(
    "nes",
    "NES",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 256 };
      s.dither.algorithm = "bayer4";
      s.dither.strength = 0.5;
      s.palette.distance = "redmean";
      withColors(s, [
        "#000000", "#fcfcfc", "#bcbcbc", "#7c7c7c", "#a80020", "#f83800", "#fca044", "#f8b800",
        "#00a800", "#58d854", "#0058f8", "#3cbcfc", "#6844fc", "#d800cc", "#a4e4fc", "#503000",
      ]);
    },
    "games",
  ),
  builtIn(
    "windows-95",
    "Windows 95",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 320 };
      s.dither.algorithm = "bayer4";
      withPalette(s, "ega");
    },
    "games",
  ),

  // ── Print ───────────────────────────────────────────────────────────────
  builtIn(
    "risograph",
    "Risograph",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 480 };
      s.dither.algorithm = "halftone";
      s.adjust.contrast = 10;
      withColors(s, ["#f2ede0", "#ff48b0", "#0078bf", "#1a1a1a"]);
    },
    "print",
  ),
  builtIn(
    "cyanotype",
    "Cyanotype",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 480 };
      s.dither.algorithm = "atkinson";
      s.adjust.saturation = -100;
      s.palette.distance = "luma";
      withColors(s, ["#0b2545", "#13315c", "#1d4e89", "#8da9c4", "#eef4ed"]);
    },
    "print",
  ),
  builtIn(
    "polaroid",
    "Polaroid",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 360 };
      s.dither.algorithm = "blue-noise";
      s.adjust.contrast = -10;
      s.adjust.gamma = 1.1;
      withColors(s, ["#2b2118", "#6b4f3a", "#b08968", "#e6ccb2", "#f5ebe0"]);
    },
    "print",
  ),

  // ── Wild ────────────────────────────────────────────────────────────────
  builtIn(
    "acid-rave",
    "Acid Rave",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 400 };
      s.dither.algorithm = "bayer2";
      s.adjust.saturation = 80;
      s.adjust.contrast = 35;
      s.palette.distance = "redmean";
      withPalette(s, "rgb8");
    },
    "wild",
  ),
  builtIn(
    "thermal-cam",
    "Thermal Cam",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 360 };
      s.dither.algorithm = "bayer8";
      s.adjust.saturation = -100;
      s.adjust.contrast = 20;
      s.palette.distance = "luma";
      withColors(s, ["#000000", "#1b0c41", "#4a0c6b", "#a52c60", "#ed6925", "#fbb61a", "#fcffa4"]);
    },
    "wild",
  ),
  builtIn(
    "vaporwave",
    "Vaporwave",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 480 };
      s.dither.algorithm = "halftone";
      s.adjust.saturation = 40;
      s.palette.distance = "redmean";
      withColors(s, ["#1a1033", "#ff71ce", "#01cdfe", "#05ffa1", "#b967ff", "#fffb96"]);
    },
    "wild",
  ),
  builtIn(
    "broken-signal",
    "Broken Signal",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 512 };
      s.dither.algorithm = "riemersma";
      s.adjust.contrast = 25;
      withPalette(s, "cmyk");
    },
    "wild",
  ),
  builtIn(
    "matrix",
    "Matrix",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 400 };
      s.dither.algorithm = "lines-v";
      s.adjust.saturation = -100;
      s.adjust.contrast = 30;
      s.palette.distance = "luma";
      withColors(s, ["#000000", "#003b00", "#008f11", "#00ff41"]);
    },
    "wild",
  ),
  builtIn(
    "blueprint",
    "Blueprint",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 480 };
      s.dither.algorithm = "lines-d";
      s.adjust.invert = true;
      s.adjust.contrast = 40;
      withColors(s, ["#0b3d91", "#e8f1ff"]);
    },
    "wild",
  ),
  builtIn(
    "radioactive",
    "Radioactive",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 400 };
      s.dither.algorithm = "blue-noise";
      s.adjust.curves = identityCurves();
      s.adjust.curves.master = [
        { x: 0, y: 0 },
        { x: 70, y: 20 },
        { x: 180, y: 235 },
        { x: 255, y: 255 },
      ];
      withColors(s, ["#050505", "#39ff14"]);
    },
    "wild",
  ),
  builtIn(
    "meltdown",
    "Meltdown",
    (s) => {
      s.resize = { ...s.resize, mode: "width", width: 480 };
      // No serpentine: the error drags right on every row, smearing into streaks.
      s.dither.algorithm = "sierra-lite";
      s.dither.serpentine = false;
      s.adjust.saturation = 60;
      withPalette(s, "sweetie16");
    },
    "wild",
  ),
];

export type ImportMode = "merge" | "replace";

interface PresetState {
  presets: Preset[];
  savePreset: (name: string, settings: DitherSettings) => string;
  overwritePreset: (id: string, settings: DitherSettings) => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  /** Adds (merge) or swaps in (replace) presets; returns how many were added. */
  importPresets: (presets: Preset[], mode: ImportMode) => number;
}

/**
 * Validates presets from storage or an imported file. Drops malformed entries, fills settings
 * added since they were saved, and never lets anything claim to be built-in.
 */
export function normalizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.name === "string" && x.settings)
    .map((x) => ({
      id: x.id,
      name: x.name,
      settings: completeSettings(x.settings),
      createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
    }));
}


export const usePresetStore = create<PresetState>()(
  persist(
    immer((set) => ({
      presets: [],
      savePreset: (name, settings) => {
        const id = newId();
        set((s) => {
          s.presets.push({
            id,
            name: name.trim() || `Preset ${s.presets.length + 1}`,
            settings: structuredClone(settings),
            createdAt: Date.now(),
          });
        });
        return id;
      },
      overwritePreset: (id, settings) =>
        set((s) => {
          const preset = s.presets.find((p) => p.id === id);
          if (preset) preset.settings = structuredClone(settings);
        }),
      renamePreset: (id, name) =>
        set((s) => {
          const preset = s.presets.find((p) => p.id === id);
          if (preset && name.trim()) preset.name = name.trim();
        }),
      deletePreset: (id) =>
        set((s) => {
          s.presets = s.presets.filter((p) => p.id !== id);
        }),
      importPresets: (incoming, mode) => {
        let added = 0;
        set((s) => {
          if (mode === "replace") {
            s.presets = structuredClone(incoming);
            added = incoming.length;
            return;
          }
          for (const preset of incoming) {
            const existing = s.presets.find((p) => p.id === preset.id);
            if (existing && deepEqual(existing.settings, preset.settings) && existing.name === preset.name) continue;
            // Same id but different content: keep both rather than overwrite.
            s.presets.push({ ...structuredClone(preset), id: existing ? newId() : preset.id });
            added++;
          }
        });
        return added;
      },
    })),
    {
      name: "dithix:presets",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ presets: s.presets }),
      merge: (persisted, current) => ({
        ...current,
        presets: normalizePresets((persisted as Partial<PresetState> | undefined)?.presets),
      }),
    },
  ),
);
