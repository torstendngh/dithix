import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useKeyframeSync } from "../use-keyframe-sync";

const store = () => useSettingsStore.getState();
const ws = () => useWorkspaceStore.getState();

describe("useKeyframeSync", () => {
  let unmount: () => void;

  beforeEach(() => {
    localStorage.clear();
    store().resetSettings();
    // 2 s at 12 fps: 24 frames, so frame 12 is t = 0.5.
    store().setMotion({ keyframes: true, duration: 2, fps: 12 });
    useWorkspaceStore.setState({ playhead: 0, playing: false, lastChange: null });
    unmount = renderHook(() => useKeyframeSync()).unmount;
  });
  afterEach(() => unmount());

  it("remembers the last single setting the user changed", () => {
    store().setAdjust({ contrast: 30 });
    expect(ws().lastChange).toBe("adjust.contrast");
    store().setDither({ strength: 0.5 });
    expect(ws().lastChange).toBe("dither.strength");
  });

  it("auto-keys a setting that already has keyframes, at the playhead", () => {
    store().setKeyframe("adjust.contrast", 0);
    ws().setPlayhead(12);
    store().setAdjust({ contrast: 80 });
    expect(store().settings.motion.tracks[0].keys).toEqual([{ t: 0, value: 0 }, { t: 0.5, value: 80 }]);
  });

  it("shows the playhead's values in the settings while paused, without keying them", () => {
    store().setKeyframe("adjust.contrast", 0); // 0 at t = 0
    ws().setPlayhead(12);
    store().setAdjust({ contrast: 80 }); // 80 at t = 0.5
    ws().setPlayhead(0);
    expect(store().settings.adjust.contrast).toBe(0);
    ws().setPlayhead(6); // halfway, smoothed
    expect(store().settings.adjust.contrast).toBeCloseTo(40);
    expect(store().settings.motion.tracks[0].keys).toHaveLength(2);
  });

  it("leaves settings alone when the timeline is off, even with motion on", () => {
    store().setAdjust({ contrast: 10 });
    store().setKeyframe("adjust.contrast", 0);
    store().setMotion({ keyframes: false, enabled: true });
    store().setAdjust({ contrast: 50 });
    ws().setPlayhead(5);
    expect(store().settings.adjust.contrast).toBe(50);
    expect(store().settings.motion.tracks[0].keys).toEqual([{ t: 0, value: 10 }]);
  });
});
