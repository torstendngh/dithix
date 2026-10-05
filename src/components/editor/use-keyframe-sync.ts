"use client";

import { useEffect } from "react";
import { changedPaths } from "@/lib/dither/keyframes";
import { frameCount } from "@/lib/dither/motion";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Loop position of the playhead, 0..1. */
export function playheadT(): number {
  const n = frameCount(useSettingsStore.getState().settings.motion);
  return (useWorkspaceStore.getState().playhead % n) / n;
}

/**
 * Ties the sidebar to the timeline:
 * - remembers the last keyframable setting the user changed, for "Key last change";
 * - with the timeline on, changing a setting that already has keyframes keys it at the playhead
 *   (like auto-key in a video editor);
 * - while paused, writes the tracks' values at the playhead into the settings, so the sidebar
 *   shows what the frame under the playhead uses.
 */
export function useKeyframeSync() {
  useEffect(() => {
    const settings = () => useSettingsStore.getState();
    const ws = useWorkspaceStore.getState;
    let syncing = false;

    const sync = () => {
      const { motion } = settings().settings;
      if (!motion.keyframes || motion.tracks.length === 0 || ws().playing) return;
      syncing = true;
      try {
        settings().syncTracks(playheadT());
      } finally {
        syncing = false;
      }
    };

    const unsubSettings = useSettingsStore.subscribe((s, prev) => {
      if (syncing || s.settings === prev.settings) return;
      const changed = changedPaths(prev.settings, s.settings);
      // One value at a time is a user edit; presets and resets change many at once.
      if (changed.length === 1) ws().setLastChange(changed[0]);
      const { motion } = s.settings;
      // Same track list: an edit, not a preset replacing the whole look.
      if (motion.keyframes && motion.tracks === prev.settings.motion.tracks) {
        const tracked = changed.filter((path) => motion.tracks.some((t) => t.path === path));
        for (const path of tracked) settings().setKeyframe(path, playheadT());
      }
      if (s.settings.motion !== prev.settings.motion) sync();
    });

    const unsubWorkspace = useWorkspaceStore.subscribe((s, prev) => {
      if (s.playhead !== prev.playhead || s.playing !== prev.playing) sync();
    });

    return () => {
      unsubSettings();
      unsubWorkspace();
    };
  }, []);
}
