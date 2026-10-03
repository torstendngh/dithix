"use client";

import Image from "next/image";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { useUiStore } from "@/stores/ui-store";
import { pickImage } from "./actions";
import { IconButton } from "./fields";
import { PresetPicker } from "./preset-picker";

export function SidebarHeader() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <>
      {/* Scrolls away with the panels. */}
      <h1 className="flex justify-center px-3 pt-4 pb-1">
        <Image
          src="/logo-2.png"
          alt="dithix"
          width={1816}
          height={1024}
          // Pixel art on an 8px grid (227×128 art pixels): skip the optimiser's smooth resize and
          // show it at exactly 227px so each art pixel maps to one CSS pixel, kept crisp.
          unoptimized
          preload
          className="h-auto w-[227px] max-w-full select-none [image-rendering:pixelated]"
          draggable={false}
        />
      </h1>
      {/* Pins to the top of the sidebar once the logo has scrolled past. */}
      <div className="sticky top-0 z-30 grid gap-1 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <div className="flex gap-1">
          <Button onClick={pickImage} className="flex-1">
            <PixelIcon name="upload" />
            Open image
            <kbd className="ml-1 font-mono text-2xs opacity-50">⌘O</kbd>
          </Button>
          <IconButton
            icon="gear"
            label="Settings"
            variant="outline"
            size="icon"
            side="bottom"
            onClick={() => setSettingsOpen(true)}
          />
        </div>
        <PresetPicker />
      </div>
    </>
  );
}
