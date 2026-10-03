import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { IDENTITY_CURVE } from "@/lib/dither/adjust";
import { completeSettings, defaultExportSettings, defaultSettings } from "@/lib/dither/defaults";
import { defaultParams, getFilter, MAX_FILTERS } from "@/lib/dither/filters";
import { getPalettePreset } from "@/lib/dither/palettes";
import { newId } from "@/lib/new-id";
import type {
  AdjustSettings,
  ColorDistance,
  CurveChannel,
  CurvePoint,
  DitherOptions,
  DitherSettings,
  BackgroundSettings,
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
  /** Appends a filter with default params; returns its id (or null at the limit / unknown type). */
  addFilter: (type: string) => string | null;
  removeFilter: (id: string) => void;
  moveFilter: (id: string, direction: -1 | 1) => void;
  setFilterEnabled: (id: string, enabled: boolean) => void;
  setFilterParam: (id: string, key: string, value: number) => void;
  clearFilters: () => void;
  setBackground: (patch: Partial<BackgroundSettings>) => void;
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
    immer((set, get) => ({
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
      addFilter: (type) => {
        const def = getFilter(type);
        if (!def || get().settings.filters.length >= MAX_FILTERS) return null;
        const id = newId();
        set((s) => {
          s.settings.filters.push({ id, type, enabled: true, params: defaultParams(def) });
        });
        return id;
      },
      removeFilter: (id) =>
        set((s) => {
          s.settings.filters = s.settings.filters.filter((f) => f.id !== id);
        }),
      moveFilter: (id, direction) =>
        set((s) => {
          const list = s.settings.filters;
          const i = list.findIndex((f) => f.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= list.length) return;
          [list[i], list[j]] = [list[j], list[i]];
        }),
      setFilterEnabled: (id, enabled) =>
        set((s) => {
          const f = s.settings.filters.find((x) => x.id === id);
          if (f) f.enabled = enabled;
        }),
      setFilterParam: (id, key, value) =>
        set((s) => {
          const f = s.settings.filters.find((x) => x.id === id);
          const p = f && getFilter(f.type)?.params.find((x) => x.key === key);
          if (f && p) f.params[key] = Math.min(p.max, Math.max(p.min, value));
        }),
      clearFilters: () =>
        set((s) => {
          s.settings.filters = [];
        }),
      setBackground: (patch) =>
        set((s) => {
          Object.assign(s.settings.background, patch);
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
