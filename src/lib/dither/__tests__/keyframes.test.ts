import { describe, expect, it } from "vitest";
import { baseSettings, completeSettings } from "../defaults";
import { defaultParams, getFilter } from "../filters";
import {
  applyTracks,
  changedPaths,
  filterPath,
  moveKey,
  normalizeTracks,
  readPath,
  setKey,
  trackLabel,
  valueAt,
  withoutTrackedValues,
} from "../keyframes";
import type { DitherSettings, MotionTrack } from "../types";

const track = (keys: [number, number][], easing: MotionTrack["easing"] = "linear"): MotionTrack => ({
  path: "adjust.contrast",
  easing,
  keys: keys.map(([t, value]) => ({ t, value })),
});

const withWave = (): DitherSettings => {
  const s = baseSettings();
  s.filters = [{ id: "w1", type: "wave", enabled: true, animate: true, params: defaultParams(getFilter("wave")!) }];
  return s;
};

describe("valueAt", () => {
  it("holds a single key and interpolates between two", () => {
    expect(valueAt(track([[0.3, 7]]), 0.9)).toBe(7);
    const tr = track([[0, 0], [0.5, 100]]);
    expect(valueAt(tr, 0)).toBe(0);
    expect(valueAt(tr, 0.25)).toBeCloseTo(50);
    expect(valueAt(tr, 0.5)).toBe(100);
  });

  it("wraps from the last key back to the first, so the loop is seamless", () => {
    const tr = track([[0.25, 0], [0.75, 100]]);
    expect(valueAt(tr, 0)).toBeCloseTo(50); // halfway along 0.75 → 1.25
    expect(valueAt(tr, 0.999)).toBeCloseTo(valueAt(tr, 0), 0);
  });

  it("eases smoothly, holds with step, and options always hold", () => {
    expect(valueAt(track([[0, 0], [0.5, 100]], "smooth"), 0.125)).toBeLessThan(25);
    expect(valueAt(track([[0, 0], [0.5, 100]], "step"), 0.49)).toBe(0);
    expect(valueAt(track([[0, 0], [0.5, 1]], "linear"), 0.25, true)).toBe(0);
  });
});

describe("paths", () => {
  it("read and write fixed settings and filter params, ignoring unknown paths", () => {
    const s = withWave();
    expect(readPath(s, "adjust.contrast")).toBe(0);
    expect(readPath(s, filterPath("w1", "amplitude"))).toBe(12);
    expect(readPath(s, "resize.width")).toBeUndefined(); // would change the frame size
    expect(readPath(s, filterPath("gone", "amplitude"))).toBeUndefined();
    expect(trackLabel(s, filterPath("w1", "amplitude"))).toBe("Wave · Amplitude");
  });

  it("changedPaths reports keyframable values that changed", () => {
    const a = withWave();
    const b = structuredClone(a);
    b.adjust.contrast = 20;
    b.filters[0].params.amplitude = 30;
    b.palette.colors = ["#000000"];
    expect(changedPaths(a, b)).toEqual(["adjust.contrast", filterPath("w1", "amplitude")]);
  });
});

describe("tracks in settings", () => {
  it("applyTracks writes each track's value; withoutTrackedValues hides them from the render key", () => {
    const s = withWave();
    s.motion.keyframes = true;
    s.motion.tracks = [track([[0, 0], [0.5, 50]])];
    applyTracks(s, 0.5);
    expect(s.adjust.contrast).toBe(50);
    const other = structuredClone(s);
    other.adjust.contrast = -10;
    expect(withoutTrackedValues(other)).toEqual(withoutTrackedValues(s));
  });

  it("setKey replaces a key at the same time and keeps keys sorted; moveKey replaces its target", () => {
    const tr = track([[0.5, 1]]);
    setKey(tr, 0.25, 2);
    setKey(tr, 0.5, 3);
    expect(tr.keys).toEqual([{ t: 0.25, value: 2 }, { t: 0.5, value: 3 }]);
    moveKey(tr, 0.25, 0.5);
    expect(tr.keys).toEqual([{ t: 0.5, value: 2 }]);
  });

  it("normalizeTracks drops unknown paths and bad keys, and completeSettings keeps good tracks", () => {
    const s = withWave();
    const raw = [
      { path: "adjust.contrast", easing: "nope", keys: [{ t: 0.5, value: 1 }, { t: "x", value: 2 }, { t: 0.1, value: 3 }] },
      { path: filterPath("missing", "amplitude"), easing: "linear", keys: [] },
      { path: "adjust.contrast", easing: "linear", keys: [] },
    ];
    expect(normalizeTracks(raw, s)).toEqual([
      { path: "adjust.contrast", easing: "smooth", keys: [{ t: 0.1, value: 3 }, { t: 0.5, value: 1 }] },
    ]);
    s.motion.tracks = [track([[0, 1]])];
    expect(completeSettings(structuredClone(s)).motion.tracks).toEqual(s.motion.tracks);
  });

  it("carries the old all-filters motion switch over to each filter", () => {
    const raw = { ...withWave(), motion: { ...baseSettings().motion, animateFilters: false } };
    expect(completeSettings(raw).filters[0].animate).toBe(false);
  });
});
