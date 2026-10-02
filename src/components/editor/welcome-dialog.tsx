"use client";

import Image from "next/image";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { openSample } from "./actions";

const POINTS: { icon: IconName; title: string; body: React.ReactNode }[] = [
  {
    icon: "dither",
    title: "Dither anything",
    body: "Open, drop or paste an image. 25 algorithms — Bayer 2×2 to 32×32, error diffusion, noise — plus palettes, curves and the glitch gradient. Export PNG, JPG or SVG.",
  },
  {
    icon: "eye",
    title: "Stays on your device",
    body: "Images are processed right here in your browser and are never uploaded. No account needed.",
  },
  {
    icon: "save",
    title: "Saved in localStorage",
    body: (
      <>
        Your settings, presets and this notice are kept in this browser&apos;s localStorage (
        <code className="text-zinc-300">dithix:settings</code>, <code className="text-zinc-300">dithix:presets</code>,{" "}
        <code className="text-zinc-300">dithix:ui</code>). Clearing site data or switching browsers resets them.
      </>
    ),
  },
];

const SHORTCUTS = [
  ["⌘O", "open"],
  ["⌘S", "export"],
  ["Space", "compare"],
  ["Scroll", "zoom"],
  ["Drag", "pan"],
];

export function WelcomeDialog() {
  const open = useUiStore((s) => s.welcomeOpen);
  const closeWelcome = useUiStore((s) => s.closeWelcome);
  const hasImage = useWorkspaceStore((s) => s.source !== null);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeWelcome()}>
      <DialogContent className="max-w-md">
        <div className="relative h-40 overflow-hidden border-b border-zinc-800">
          <Image
            src="/bg.png"
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 448px"
            preload
            className="object-cover brightness-[0.45] saturate-[0.9]"
            draggable={false}
          />
          {/* Fade into the dialog body so the header doesn't end on a hard edge. */}
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-zinc-950/90" />
          <div className="absolute inset-0 grid place-items-center">
            <Image
              src="/logo-2.png"
              alt="dithix"
              width={1816}
              height={1024}
              sizes="240px"
              preload
              className="h-auto w-60 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] select-none"
              draggable={false}
            />
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-1.5">
            <DialogTitle>Turn images into dithered pixel art</DialogTitle>
            <DialogDescription>A quick note before you start.</DialogDescription>
          </div>

          <ul className="grid gap-4">
            {POINTS.map((p) => (
              <li key={p.title} className="grid grid-cols-[auto_1fr] gap-3">
                <span className="grid size-7 place-items-center border border-zinc-800 bg-zinc-900 text-zinc-300">
                  <PixelIcon name={p.icon} scale={1} />
                </span>
                <div className="grid gap-1">
                  <span className="text-zinc-100">{p.title}</span>
                  <p className="leading-relaxed text-zinc-400">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800 pt-4 text-2xs text-zinc-500">
            {SHORTCUTS.map(([key, action]) => (
              <span key={key}>
                <kbd className="border border-zinc-700 px-1 text-zinc-300">{key}</kbd> {action}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={closeWelcome}>
              Start dithering
            </Button>
            {!hasImage && (
              <Button
                variant="outline"
                onClick={() => {
                  closeWelcome();
                  void openSample();
                }}
              >
                <PixelIcon name="wand" scale={1} />
                Try sample
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
