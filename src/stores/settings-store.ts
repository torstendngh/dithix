import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { IDENTITY_CURVE } from "@/lib/dither/adjust";
import { completeSettings, defaultExportSettings, defaultSettings } from "@/lib/dither/defaults";
import { defaultParams, getFilter, MAX_FILTERS } from "@/lib/dither/filters";
import { applyTracks, filterPath, moveKey, readPath, setKey } from "@/lib/dither/keyframes";
import { getPalettePreset } from "@/lib/dither/palettes";
import { newId } from "@/lib/new-id";
import type {
  AdjustSettings,
  ColorDistance,
  CurveChannel,
  CurvePoint,
  DitherOptions,
  Easing,
  DitherSettings,
  BackgroundSettings,
  ExportSettings,
  MotionSettings,
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
  /** Appends a filter with default params; returns its id (or null at the limit / unknown / duplicate unique type). */
  addFilter: (type: string) => string | null;
  removeFilter: (id: string) => void;
  moveFilter: (id: string, direction: -1 | 1) => void;
  setFilterEnabled: (id: string, enabled: boolean) => void;
  setFilterParam: (id: string, key: string, value: number) => void;
  setFilterAnimate: (id: string, animate: boolean) => void;
  clearFilters: () => void;
  setBackground: (patch: Partial<BackgroundSettings>) => void;
  setMotion: (patch: Partial<MotionSettings>) => void;
  /** Keys the setting's current value at loop position t, creating its track if needed. */
  setKeyframe: (path: string, t: number) => void;
  removeKeyframe: (path: string, t: number) => void;
  moveKeyframe: (path: string, from: number, to: number) => void;
  setTrackEasing: (path: string, easing: Easing) => void;
  removeTrack: (path: string) => void;
  /**
   * Writes the tracks' values at loop position t into the settings, so the sidebar shows the
   * playhead's values. The loop itself doesn't change (see `withoutTrackedValues`).
   */
  syncTracks: (t: number) => void;
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
      addFilter: (type) => {
        const def = getFilter(type);
        const { filters } = get().settings;
        if (!def || filters.length >= MAX_FILTERS || (def.unique && filters.some((f) => f.type === type))) return null;
        const id = newId();
        set((s) => {
          s.settings.filters.push({ id, type, enabled: true, animate: true, params: defaultParams(def) });
        });
        return id;
      },
      removeFilter: (id) =>
        set((s) => {
          s.settings.filters = s.settings.filters.filter((f) => f.id !== id);
          const prefix = filterPath(id, "");
          s.settings.motion.tracks = s.settings.motion.tracks.filter((t) => !t.path.startsWith(prefix));
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
      setFilterAnimate: (id, animate) =>
        set((s) => {
          const f = s.settings.filters.find((x) => x.id === id);
          if (f) f.animate = animate;
        }),
      clearFilters: () =>
        set((s) => {
          s.settings.filters = [];
          s.settings.motion.tracks = s.settings.motion.tracks.filter((t) => !t.path.startsWith("filter:"));
        }),
      setBackground: (patch) =>
        set((s) => {
          Object.assign(s.settings.background, patch);
        }),
      setMotion: (patch) =>
        set((s) => {
          Object.assign(s.settings.motion, patch);
        }),
      setKeyframe: (path, t) =>
        set((s) => {
          const value = readPath(s.settings, path);
          if (value === undefined) return;
          const { tracks } = s.settings.motion;
          let track = tracks.find((x) => x.path === path);
          if (!track) {
            track = { path, easing: "smooth", keys: [] };
            tracks.push(track);
          }
          setKey(track, t, value);
        }),
      removeKeyframe: (path, t) =>
        set((s) => {
          const { tracks } = s.settings.motion;
          const track = tracks.find((x) => x.path === path);
          if (!track) return;
          track.keys = track.keys.filter((k) => Math.abs(k.t - t) >= 1e-4);
          // A track without keys has nothing left to show.
          if (track.keys.length === 0) s.settings.motion.tracks = tracks.filter((x) => x !== track);
        }),
      moveKeyframe: (path, from, to) =>
        set((s) => {
          const track = s.settings.motion.tracks.find((x) => x.path === path);
          if (track) moveKey(track, from, to);
        }),
      setTrackEasing: (path, easing) =>
        set((s) => {
          const track = s.settings.motion.tracks.find((x) => x.path === path);
          if (track) track.easing = easing;
        }),
      removeTrack: (path) =>
        set((s) => {
          s.settings.motion.tracks = s.settings.motion.tracks.filter((x) => x.path !== path);
        }),
      syncTracks: (t) =>
        set((s) => {
          applyTracks(s.settings, t);
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
