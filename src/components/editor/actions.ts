"use client";

import {
  ANIMATED_FORMATS,
  createSampleImage,
  downloadBlob,
  exportFileName,
  loadImage,
  renderAnimation,
  renderExport,
} from "@/lib/image-io";
import { isLooping } from "@/lib/dither/motion";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Imperative actions shared by buttons, shortcuts, drag & drop and paste. */

export async function openImage(blob: Blob, name: string) {
  try {
    useWorkspaceStore.getState().setSource(await loadImage(blob, name));
  } catch (err) {
    useWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Could not open image");
  }
}

export async function openSample() {
  useWorkspaceStore.getState().setSource(await createSampleImage());
}

export function pickImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void openImage(file, file.name);
  };
  input.click();
}

/** True while an export is being encoded (MP4 and big GIFs take a moment). */
let exporting = false;

export async function exportResult() {
  const { result, source, frames, frameTotal } = useWorkspaceStore.getState();
  if (!result || !source || exporting) return;
  const { exportSettings, settings } = useSettingsStore.getState();
  const background = settings.palette.colors[0] ?? "#000000";
  const animated = isLooping(settings.motion) && ANIMATED_FORMATS.includes(exportSettings.format);
  try {
    exporting = true;
    useWorkspaceStore.getState().setExporting(true);
    let blob: Blob;
    if (animated) {
      if (frameTotal === 0 || frames.length < frameTotal) throw new Error("The animation is still rendering — try again in a moment");
      blob = await renderAnimation(frames, settings.motion.fps, exportSettings, background);
    } else {
      if (exportSettings.format === "gif" || exportSettings.format === "mp4") {
        throw new Error(`Turn on Motion or the timeline to export ${exportSettings.format.toUpperCase()}`);
      }
      // With a finished loop on screen, the still is the frame under the playhead.
      const { playhead } = useWorkspaceStore.getState();
      const still = isLooping(settings.motion) && frameTotal > 0 && frames.length === frameTotal ? frames[playhead % frames.length] : result;
      blob = await renderExport(still, exportSettings, background);
    }
    downloadBlob(blob, exportFileName(source.name, exportSettings.format));
  } catch (err) {
    useWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Export failed");
  } finally {
    exporting = false;
    useWorkspaceStore.getState().setExporting(false);
  }
}
