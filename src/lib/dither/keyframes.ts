import { getFilter } from "./filters";
import type { DitherSettings, Easing, Keyframe, MotionTrack } from "./types";

/**
 * Keyframed settings. A track animates one numeric setting, addressed by a path: a dotted path
 * for the fixed settings ("adjust.contrast") or `filter:<id>:<param>` for a filter param. Keys
 * sit at loop positions t ∈ [0, 1), so they stretch with the loop length, and interpolation wraps
 * from the last key back to the first, so every track loops seamlessly.
 */

/** Settings outside the filter stack that can be keyframed. Size-changing ones are left out: every frame must share one size. */
export const KEYFRAMABLE: { path: string; label: string }[] = [
  { path: "adjust.brightness", label: "Brightness" },
  { path: "adjust.contrast", label: "Contrast" },
  { path: "adjust.gamma", label: "Gamma" },
  { path: "adjust.saturation", label: "Saturation" },
  { path: "adjust.hue", label: "Hue" },
  { path: "dither.strength", label: "Dither amount" },
  { path: "dither.spread", label: "Dither range" },
  { path: "dither.bias", label: "Dither bias" },
  { path: "background.size", label: "Background size" },
];

export const EASINGS: { value: Easing; label: string }[] = [
  { value: "smooth", label: "Smooth" },
  { value: "linear", label: "Linear" },
  { value: "step", label: "Hold" },
];

/** Keys closer than this share a time (well under one frame at the longest loop). */
const SAME_TIME = 1e-4;

export const filterPath = (id: string, key: string) => `filter:${id}:${key}`;

function parseFilterPath(path: string): { id: string; key: string } | null {
  if (!path.startsWith("filter:")) return null;
  const rest = path.slice(7);
  const split = rest.lastIndexOf(":");
  return split > 0 ? { id: rest.slice(0, split), key: rest.slice(split + 1) } : null;
}

/** Current value of a keyframable setting, or undefined if the path doesn't resolve. */
export function readPath(settings: DitherSettings, path: string): number | undefined {
  const fp = parseFilterPath(path);
  if (fp) {
    const v = settings.filters.find((f) => f.id === fp.id)?.params[fp.key];
    return typeof v === "number" ? v : undefined;
  }
  if (!KEYFRAMABLE.some((k) => k.path === path)) return undefined;
  const [group, key] = path.split(".");
  const v = (settings as unknown as Record<string, Record<string, unknown>>)[group]?.[key];
  return typeof v === "number" ? v : undefined;
}

export function writePath(settings: DitherSettings, path: string, value: number) {
  const fp = parseFilterPath(path);
  if (fp) {
    const f = settings.filters.find((x) => x.id === fp.id);
    if (f && fp.key in f.params) f.params[fp.key] = value;
    return;
  }
  if (!KEYFRAMABLE.some((k) => k.path === path)) return;
  const [group, key] = path.split(".");
  (settings as unknown as Record<string, Record<string, number>>)[group][key] = value;
}

/** Every keyframable path in these settings. */
export function keyframablePaths(settings: DitherSettings): string[] {
  const paths = KEYFRAMABLE.map((k) => k.path);
  for (const f of settings.filters) {
    for (const p of getFilter(f.type)?.params ?? []) paths.push(filterPath(f.id, p.key));
  }
  return paths;
}

/** Keyframable settings whose value differs between two versions of the settings. */
export function changedPaths(prev: DitherSettings, next: DitherSettings): string[] {
  return keyframablePaths(next).filter((path) => {
    const a = readPath(prev, path);
    return a !== undefined && a !== readPath(next, path);
  });
}

export function trackLabel(settings: DitherSettings, path: string): string {
  const fp = parseFilterPath(path);
  if (fp) {
    const f = settings.filters.find((x) => x.id === fp.id);
    const def = f && getFilter(f.type);
    const param = def?.params.find((p) => p.key === fp.key);
    return def && param ? `${def.name} · ${param.label}` : path;
  }
  return KEYFRAMABLE.find((k) => k.path === path)?.label ?? path;
}

/** Params with discrete options (directions, modes) jump between keys instead of blending. */
export function isDiscrete(settings: DitherSettings, path: string): boolean {
  const fp = parseFilterPath(path);
  if (!fp) return false;
  const f = settings.filters.find((x) => x.id === fp.id);
  return !!getFilter(f?.type ?? "")?.params.find((p) => p.key === fp.key)?.options;
}

const ease = (easing: Easing, u: number) =>
  easing === "step" ? 0 : easing === "smooth" ? u * u * (3 - 2 * u) : u;

/** Value of a track at loop position t, wrapping from the last key around to the first. */
export function valueAt(track: MotionTrack, t: number, discrete = false): number {
  const keys = track.keys;
  if (keys.length === 0) return 0;
  if (keys.length === 1) return keys[0].value;
  let next = keys.findIndex((k) => k.t > t);
  if (next === -1) next = 0;
  const prev = (next - 1 + keys.length) % keys.length;
  const a = keys[prev];
  const b = keys[next];
  // Distances along the loop, so the last → first segment crosses t = 1.
  const span = (((b.t - a.t) % 1) + 1) % 1 || 1;
  const u = ((((t - a.t) % 1) + 1) % 1) / span;
  const k = ease(discrete ? "step" : track.easing, Math.min(1, Math.max(0, u)));
  return a.value + (b.value - a.value) * k;
}

/** Writes every track's value at loop position t into the settings (in place). */
export function applyTracks(settings: DitherSettings, t: number) {
  for (const track of settings.motion.tracks) {
    if (readPath(settings, track.path) === undefined || track.keys.length === 0) continue;
    writePath(settings, track.path, valueAt(track, t, isDiscrete(settings, track.path)));
  }
}

/**
 * The settings with keyframed values blanked: what decides how the loop renders. Writing the
 * playhead's values back into the settings (so the sidebar shows them) doesn't change it.
 */
export function withoutTrackedValues(settings: DitherSettings): DitherSettings {
  if (!settings.motion.keyframes || settings.motion.tracks.length === 0) return settings;
  const s = structuredClone(settings);
  for (const track of s.motion.tracks) if (track.keys.length) writePath(s, track.path, 0);
  return s;
}

export const keyIndexAt = (track: MotionTrack, t: number) => track.keys.findIndex((k) => Math.abs(k.t - t) < SAME_TIME);

/** Adds a key at t, or replaces the value of the one already there. Keeps keys sorted. */
export function setKey(track: MotionTrack, t: number, value: number) {
  const i = keyIndexAt(track, t);
  if (i >= 0) track.keys[i].value = value;
  else {
    track.keys.push({ t, value });
    track.keys.sort((a, b) => a.t - b.t);
  }
}

/** Moves the key at `from` to `to`, replacing any key already at `to`. */
export function moveKey(track: MotionTrack, from: number, to: number) {
  const i = keyIndexAt(track, from);
  if (i < 0) return;
  const { value } = track.keys[i];
  track.keys.splice(i, 1);
  setKey(track, to, value);
}

const EASING_VALUES = new Set(EASINGS.map((e) => e.value));

/** Validates stored tracks: drops unknown paths and bad keys, merges duplicates, sorts. */
export function normalizeTracks(raw: unknown, settings: DitherSettings): MotionTrack[] {
  if (!Array.isArray(raw)) return [];
  const out: MotionTrack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const tr = item as Partial<MotionTrack>;
    if (typeof tr.path !== "string" || readPath(settings, tr.path) === undefined) continue;
    if (out.some((x) => x.path === tr.path)) continue;
    const track: MotionTrack = {
      path: tr.path,
      easing: EASING_VALUES.has(tr.easing as Easing) ? (tr.easing as Easing) : "smooth",
      keys: [],
    };
    for (const k of Array.isArray(tr.keys) ? (tr.keys as Partial<Keyframe>[]) : []) {
      if (typeof k?.t !== "number" || typeof k.value !== "number" || !Number.isFinite(k.t) || !Number.isFinite(k.value)) continue;
      setKey(track, Math.min(1 - SAME_TIME, Math.max(0, k.t)), k.value);
    }
    out.push(track);
  }
  return out;
}
