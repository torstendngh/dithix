"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { exportResult, openImage, pickImage } from "./actions";
import { AdjustPanel } from "./panels/adjust-panel";
import { BackgroundPanel } from "./panels/background-panel";
import { CurvesPanel } from "./panels/curves-panel";
import { DitherPanel } from "./panels/dither-panel";
import { ExportPanel } from "./panels/export-panel";
import { FiltersPanel } from "./panels/filters-panel";
import { PalettePanel } from "./panels/palette-panel";
import { ResolutionPanel } from "./panels/resolution-panel";
import { SidebarHeader } from "./sidebar-header";
import { useDitherProcessor } from "./use-dither-processor";
import { Viewport } from "./viewport";
import { SettingsDialog } from "./settings-dialog";
import { WelcomeDialog } from "./welcome-dialog";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

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
      if (mod || e.altKey || isTyping(e.target)) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        ws().setCompare(true);
      } else if (e.key === "0") ws().fitView();
      else if (e.key === "1") ws().zoomTo(1);
      else if (e.key === "+" || e.key === "=") ws().stepZoom(1);
      else if (e.key === "-") ws().stepZoom(-1);
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
  useShortcuts();

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Viewport />
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
          <ExportPanel />
        </div>
      </aside>
      <WelcomeDialog />
      <SettingsDialog />
    </div>
  );
}
