"use client";

import { createSampleImage, downloadBlob, exportFileName, loadImage, renderExport } from "@/lib/image-io";
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

export async function exportResult() {
  const { result, source } = useWorkspaceStore.getState();
  if (!result || !source) return;
  const { exportSettings, settings } = useSettingsStore.getState();
  try {
    const blob = await renderExport(result, exportSettings, settings.palette.colors[0] ?? "#000000");
    downloadBlob(blob, exportFileName(source.name, exportSettings.format));
  } catch (err) {
    useWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Export failed");
  }
}
