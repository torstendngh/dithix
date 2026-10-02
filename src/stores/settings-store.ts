import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { IDENTITY_CURVE } from "@/lib/dither/adjust";
import { completeSettings, defaultExportSettings, defaultSettings } from "@/lib/dither/defaults";
import { getPalettePreset } from "@/lib/dither/palettes";
import type {
  AdjustSettings,
  ColorDistance,
  CurveChannel,
  CurvePoint,
  DitherOptions,
  DitherSettings,
  ExportSettings,
  GradientSettings,
  ResizeSettings,
} from "@/lib/dither/types";
import { mergeDefaults } from "@/lib/merge-defaults";

export const MAX_PALETTE_COLORS = 64;

interface SettingsState {
  settings: DitherSettings;
  exportSettings: ExportSettings;

  setResize: (patch: Partial<ResizeSettings>) => void;
  setAdjust: (patch: Partial<Omit<AdjustSettings, "curves">>) => void;
  setCurve: (channel: CurveChannel, points: CurvePoint[]) => void;
  resetCurves: (channel?: CurveChannel) => void;
  setDither: (patch: Partial<DitherOptions>) => void;
  setGradient: (patch: Partial<GradientSettings>) => void;
  setPalettePreset: (id: string) => void;
  setPaletteColors: (colors: string[]) => void;
  setPaletteColor: (index: number, hex: string) => void;
  addPaletteColor: (hex: string) => void;
  removePaletteColor: (index: number) => void;
  setColorDistance: (distance: ColorDistance) => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  /** Replace all look settings, e.g. when applying a preset. */
  applySettings: (settings: DitherSettings) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      settings: defaultSettings(),
      exportSettings: defaultExportSettings(),

      setResize: (patch) =>
        set((s) => {
          Object.assign(s.settings.resize, patch);
        }),
      setAdjust: (patch) =>
        set((s) => {
          Object.assign(s.settings.adjust, patch);
        }),
      setCurve: (channel, points) =>
        set((s) => {
          s.settings.adjust.curves[channel] = points;
        }),
      resetCurves: (channel) =>
        set((s) => {
          const channels: CurveChannel[] = channel ? [channel] : ["master", "r", "g", "b"];
          for (const c of channels) s.settings.adjust.curves[c] = IDENTITY_CURVE.map((p) => ({ ...p }));
        }),
      setDither: (patch) =>
        set((s) => {
          Object.assign(s.settings.dither, patch);
        }),
      setGradient: (patch) =>
        set((s) => {
          Object.assign(s.settings.gradient, patch);
        }),
      setPalettePreset: (id) =>
        set((s) => {
          const preset = getPalettePreset(id);
          if (!preset) return;
          s.settings.palette.presetId = id;
          s.settings.palette.colors = [...preset.colors];
        }),
      setPaletteColors: (colors) =>
        set((s) => {
          s.settings.palette.presetId = null;
          s.settings.palette.colors = colors.slice(0, MAX_PALETTE_COLORS);
        }),
      setPaletteColor: (index, hex) =>
        set((s) => {
          if (index < 0 || index >= s.settings.palette.colors.length) return;
          s.settings.palette.colors[index] = hex.toLowerCase();
          s.settings.palette.presetId = null;
        }),
      addPaletteColor: (hex) =>
        set((s) => {
          if (s.settings.palette.colors.length >= MAX_PALETTE_COLORS) return;
          s.settings.palette.colors.push(hex.toLowerCase());
          s.settings.palette.presetId = null;
        }),
      removePaletteColor: (index) =>
        set((s) => {
          // A palette needs at least one colour to dither into.
          if (s.settings.palette.colors.length <= 1) return;
          s.settings.palette.colors.splice(index, 1);
          s.settings.palette.presetId = null;
        }),
      setColorDistance: (distance) =>
        set((s) => {
          s.settings.palette.distance = distance;
        }),
      setExport: (patch) =>
        set((s) => {
          Object.assign(s.exportSettings, patch);
        }),
      applySettings: (settings) =>
        set((s) => {
          s.settings = completeSettings(structuredClone(settings));
        }),
      resetSettings: () =>
        set((s) => {
          s.settings = defaultSettings();
        }),
    })),
    {
      name: "dithix:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, exportSettings: s.exportSettings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          // Gaps in older saved settings are filled from the neutral base, not the official look.
          settings: p.settings ? completeSettings(p.settings) : defaultSettings(),
          exportSettings: mergeDefaults(defaultExportSettings(), p.exportSettings),
        };
      },
    },
  ),
);
