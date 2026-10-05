import { getAlgorithm } from "./algorithms";
import { GLITCH_GRADIENT, getFilter } from "./filters";
import { applyTracks } from "./keyframes";
import type { AlgorithmId, CrawlDirection, DitherSettings, FilterInstance, MotionSettings } from "./types";

export const MOTION_FPS = [8, 12, 15, 24, 30];
export const MAX_FRAMES = 300;

/** Whether there is a loop to render: the procedural effects, the timeline, or both. */
export const isLooping = (m: Pick<MotionSettings, "enabled" | "keyframes">) => m.enabled || m.keyframes;

/** Frames in one loop. */
export function frameCount(m: Pick<MotionSettings, "duration" | "fps">): number {
  return Math.min(MAX_FRAMES, Math.max(2, Math.round(m.duration * m.fps)));
}

/**
 * Repeat length of each ordered pattern in pixels. The crawl's total distance over a loop is
 * snapped to a multiple of it, so the pattern lands back where it started.
 */
function patternPeriod(id: AlgorithmId): number {
  if (id.startsWith("bayer")) return Number(id.slice(5));
  if (id === "cluster4") return 4;
  if (id === "blue-noise") return 64;
  if (id === "ign" || id === "white-noise" || id === "threshold") return 1;
  return 8; // cluster8, halftone, lines
}

const DIRECTIONS: Record<CrawlDirection, [number, number]> = {
  right: [-1, 0],
  left: [1, 0],
  down: [0, -1],
  up: [0, 1],
};

/** Pattern offset at frame i: about `crawl` px per frame, adjusted so the loop closes. */
export function crawlOffset(m: MotionSettings, algorithm: AlgorithmId, i: number, n: number): [number, number] {
  if (m.crawl <= 0 || getAlgorithm(algorithm).kind !== "ordered") return [0, 0];
  const period = patternPeriod(algorithm);
  const total = Math.max(1, Math.round((m.crawl * n) / period)) * period;
  const d = Math.round((i * total) / n);
  const [dx, dy] = DIRECTIONS[m.crawlDirection] ?? DIRECTIONS.right;
  // Kept non-negative and within one 64px tile: every pattern period divides 64.
  const wrap = (v: number) => ((v % 64) + 64) % 64;
  return [wrap(dx * d), wrap(dy * d)];
}

const wrapRange = (v: number, lo: number, hi: number) => {
  const span = hi - lo;
  return ((((v - lo) % span) + span) % span) + lo;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Distinct, deterministic seed per boil step, so "boil every 2 frames" holds each look for 2. */
const boiled = (seed: number, step: number) => (step === 0 ? seed : (seed + step * 7919) % 99991);

/** Filters whose phase the loop rolls when their motion is on. */
const PHASED_FILTERS = new Set(["wave", "modulation", "rgb-split", "tv-glitch", "swirl", "bulge", "luma-displace", GLITCH_GRADIENT]);

/** What motion does to a filter: roll its phase, re-roll its seed with boil, both, or nothing. */
export function filterMotion(f: Pick<FilterInstance, "type" | "params">): { phase: boolean; seed: boolean } {
  return { phase: PHASED_FILTERS.has(f.type), seed: "seed" in f.params };
}

/**
 * Settings for frame i of n: keyframed values first (with the timeline on), then the procedural
 * effects on top (with motion on). Without keyframes, frame 0 equals the input.
 */
export function settingsAtFrame(settings: DitherSettings, i: number, n: number): DitherSettings {
  const m = settings.motion;
  const t = i / n;
  const wave = Math.sin(2 * Math.PI * t);
  const s = structuredClone(settings);
  if (m.keyframes) applyTracks(s, t);
  if (!m.enabled) return s;

  const [ox, oy] = crawlOffset(m, s.dither.algorithm, i, n);
  if (ox || oy) {
    s.dither.offsetX = ox;
    s.dither.offsetY = oy;
  }
  if (m.hueTurns) s.adjust.hue = wrapRange(s.adjust.hue + 360 * Math.round(m.hueTurns) * t, -180, 180);
  if (m.pulse) s.adjust.brightness = clamp(s.adjust.brightness + m.pulse * wave, -100, 100);

  const step = m.boil > 0 ? Math.floor(i / m.boil) : 0;
  if (step) s.dither.seed = boiled(s.dither.seed, step);

  for (const f of s.filters) {
    const def = getFilter(f.type);
    if (!def || !f.animate) continue;
    const p = f.params;
    if (step && "seed" in p) p.seed = boiled(p.seed, step);
    switch (f.type) {
      case "wave":
      case "modulation":
        p.phase = wrapRange(p.phase + 360 * t, 0, 360);
        break;
      case "rgb-split":
        p.angle = wrapRange(p.angle + 360 * t, 0, 360);
        break;
      case "tv-glitch":
        // The tracking band rolls down the picture once per loop.
        p.position = wrapRange(p.position + 100 * t, 0, 100);
        break;
      case "swirl":
        p.angle = p.angle * Math.cos(2 * Math.PI * t);
        break;
      case "bulge":
        p.strength = p.strength * Math.cos(2 * Math.PI * t);
        break;
      case "luma-displace":
        p.amount = p.amount * Math.cos(2 * Math.PI * t);
        break;
      case GLITCH_GRADIENT:
        // Bands breathe: the transition slides forward and back.
        p.from = clamp(p.from + 0.15 * wave, 0, 1);
        p.to = clamp(p.to + 0.15 * wave, 0, 1);
        break;
    }
    // Keep animated values inside each param's range.
    for (const pd of def.params) p[pd.key] = clamp(p[pd.key], pd.min, pd.max);
  }
  return s;
}
