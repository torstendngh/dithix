"use client";

import { useEffect } from "react";
import { frameCount } from "@/lib/dither/motion";
import { readPath } from "@/lib/dither/keyframes";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { exportResult, openImage, pickImage } from "./actions";
import { AdjustPanel } from "./panels/adjust-panel";
import { BackgroundPanel } from "./panels/background-panel";
import { CurvesPanel } from "./panels/curves-panel";
import { DitherPanel } from "./panels/dither-panel";
import { ExportPanel } from "./panels/export-panel";
import { FiltersPanel } from "./panels/filters-panel";
import { MotionPanel } from "./panels/motion-panel";
import { PalettePanel } from "./panels/palette-panel";
import { ResolutionPanel } from "./panels/resolution-panel";
import { SidebarHeader } from "./sidebar-header";
import { useDitherProcessor } from "./use-dither-processor";
import { playheadT, useKeyframeSync } from "./use-keyframe-sync";
import { Timeline } from "./timeline";
import { Viewport } from "./viewport";
import { CropDialog } from "./crop-dialog";
import { SettingsDialog } from "./settings-dialog";
import { WelcomeDialog } from "./welcome-dialog";
import { PublishDialog } from "./publish-dialog";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** K keys the last change at the playhead; , and . step a frame. */
function timelineShortcut(e: KeyboardEvent) {
  const ws = useWorkspaceStore.getState();
  const settings = useSettingsStore.getState();
  const n = frameCount(settings.settings.motion);
  if (e.key.toLowerCase() === "k") {
    if (ws.lastChange && readPath(settings.settings, ws.lastChange) !== undefined) settings.setKeyframe(ws.lastChange, playheadT());
  } else if (e.key === "," || e.key === ".") {
    ws.setPlaying(false);
    ws.setPlayhead(((ws.playhead % n) + (e.key === "," ? -1 : 1) + n) % n);
  }
}

function useShortcuts() {
  useEffect(() => {
    const ws = useWorkspaceStore.getState;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        pickImage();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void exportResult();
        return;
      }
      // The crop dialog has its own keys.
      if (mod || e.altKey || isTyping(e.target) || ws().cropping) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        ws().setCompare(true);
      } else if (e.key === "0") ws().fitView();
      else if (e.key === "1") ws().zoomTo(1);
      else if (e.key === "+" || e.key === "=") ws().stepZoom(1);
      else if (e.key === "-") ws().stepZoom(-1);
      else if (e.key.toLowerCase() === "c") ws().setCropping(true);
      else if (useSettingsStore.getState().settings.motion.keyframes) timelineShortcut(e);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") ws().setCompare(false);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void openImage(file, file.name || "pasted.png");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}

export default function Editor() {
  useDitherProcessor();
  useKeyframeSync();
  useShortcuts();

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Viewport />
        <Timeline />
      </div>
      <aside className="max-h-[50dvh] shrink-0 scroll-pt-24 overflow-y-auto border-t border-border md:max-h-none md:w-80 md:border-t-0 md:border-l">
        <SidebarHeader />
        {/* Own stacking context: z-indexed controls inside can't paint over the pinned bar. */}
        <div className="relative isolate z-0">
          <ResolutionPanel />
          <DitherPanel />
          <PalettePanel />
          <FiltersPanel />
          <BackgroundPanel />
          <AdjustPanel />
          <CurvesPanel />
          <MotionPanel />
          <ExportPanel />
        </div>
      </aside>
      <WelcomeDialog />
      <SettingsDialog />
      <CropDialog />
      <PublishDialog />
    </div>
  );
}
