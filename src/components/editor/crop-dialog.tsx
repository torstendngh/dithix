"use client";

import { useEffect, useRef, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
import {
  CROP_ASPECTS,
  fitAspect,
  isFullCrop,
  moveCrop,
  normalizedAspect,
  resizeCrop,
  type CropHandle,
} from "@/lib/crop-math";
import { cropRegion, FULL_CROP } from "@/lib/dither/frame";
import type { CropRect } from "@/lib/dither/types";
import { useWorkspaceStore, type SourceImage } from "@/stores/workspace-store";
import { Segmented } from "./fields";

/** Space kept around the image inside the stage, so edge handles stay grabbable. */
const MARGIN = 24;

const HANDLES: { id: CropHandle; style: React.CSSProperties; cursor: string }[] = [
  { id: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { id: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { id: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { id: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { id: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { id: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { id: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { id: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
];

/** Crop & pan dialog. Edits a draft; Apply (Enter) commits it, Cancel (Esc) discards it. */
export function CropDialog() {
  const open = useWorkspaceStore((s) => s.cropping);
  const source = useWorkspaceStore((s) => s.source);
  const setCropping = useWorkspaceStore((s) => s.setCropping);

  return (
    <Dialog open={open && source !== null} onOpenChange={(next) => !next && setCropping(false)}>
      <DialogContent className="flex h-[min(760px,calc(100dvh-2rem))] max-w-4xl flex-col overflow-hidden">
        {source && <CropEditor source={source} />}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({ source }: { source: SourceImage }) {
  const { applyCrop, setCropping } = useWorkspaceStore.getState();
  // The popup unmounts when closed, so every opening starts from the applied crop.
  const [crop, setCrop] = useState<CropRect>(() => useWorkspaceStore.getState().crop);
  const [cropAspect, setCropAspect] = useState(() => useWorkspaceStore.getState().cropAspect);
  const aspect = normalizedAspect(cropAspect, source.width, source.height);
  const region = cropRegion(source.width, source.height, crop);

  const changeAspect = (next: number) => {
    setCropAspect(next);
    if (next > 0) setCrop((c) => fitAspect(c, normalizedAspect(next, source.width, source.height)));
  };
  const reset = () => setCrop(aspect ? fitAspect({ ...FULL_CROP }, aspect) : { ...FULL_CROP });
  const apply = () => applyCrop(crop, cropAspect);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Enter on a focused button presses it instead.
    if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      apply();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step / source.width, 0],
      ArrowRight: [step / source.width, 0],
      ArrowUp: [0, -step / source.height],
      ArrowDown: [0, step / source.height],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setCrop((c) => moveCrop(c, m[0], m[1]));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 pt-5 pb-4">
        <div className="grid gap-1">
          <DialogTitle>Crop & pan</DialogTitle>
          <DialogDescription>Drag to pan, drag the handles to resize. Arrows nudge (Shift for 10px).</DialogDescription>
        </div>
        <DialogClose
          aria-label="Close"
          className="grid size-7 shrink-0 place-items-center text-zinc-500 outline-none hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PixelIcon name="close" scale={1} />
        </DialogClose>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-5 py-2.5">
        <Segmented aria-label="Crop aspect" className="w-auto" value={cropAspect} options={CROP_ASPECTS} onChange={changeAspect} />
        <span className="ml-auto text-2xs text-zinc-500 tabular-nums" aria-label="Crop size">
          {region.width}×{region.height}
        </span>
        <Button variant="outline" size="xs" disabled={isFullCrop(crop) && !cropAspect} onClick={reset}>
          <PixelIcon name="reset" scale={1} />
          Reset
        </Button>
      </div>

      <CropStage source={source} crop={crop} aspect={aspect} onChange={setCrop} />

      <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
        <Button variant="outline" size="sm" onClick={() => setCropping(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={apply}>
          <PixelIcon name="check" scale={1} />
          Apply
        </Button>
      </footer>
    </div>
  );
}

function CropStage({
  source,
  crop,
  aspect,
  onChange,
}: {
  source: SourceImage;
  crop: CropRect;
  aspect: number;
  onChange: (crop: CropRect) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: "move" | CropHandle; x: number; y: number; start: CropRect } | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit the whole source into the stage.
  const scale = Math.max(0.01, Math.min((stage.width - MARGIN * 2) / source.width, (stage.height - MARGIN * 2) / source.height));
  const dw = Math.round(source.width * scale);
  const dh = Math.round(source.height * scale);
  const left = Math.round((stage.width - dw) / 2);
  const top = Math.round((stage.height - dh) / 2);
  const measured = stage.width > 0 && stage.height > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !measured || dw <= 0 || dh <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(dw * dpr);
    canvas.height = Math.round(dh * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.bitmap, 0, 0, canvas.width, canvas.height);
  }, [source, dw, dh, measured]);

  const begin = (mode: "move" | CropHandle) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: crop };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / dw;
    const dy = (e.clientY - d.y) / dh;
    onChange(d.mode === "move" ? moveCrop(d.start, dx, dy) : resizeCrop(d.start, d.mode, dx, dy, aspect));
  };
  const end = () => {
    drag.current = null;
  };

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 bg-zinc-950" data-testid="crop-stage">
      {measured && (
        <>
          <div className="absolute overflow-hidden" style={{ left, top, width: dw, height: dh }}>
            <canvas ref={canvasRef} className="block size-full" />
            <div
              role="region"
              aria-label="Crop area — drag to pan"
              className="absolute cursor-move touch-none select-none"
              style={{
                left: crop.x * dw,
                top: crop.y * dh,
                width: crop.width * dw,
                height: crop.height * dh,
                // Dims everything outside the crop.
                boxShadow: "0 0 0 9999px rgba(9, 9, 11, 0.72)",
              }}
              onPointerDown={begin("move")}
              onPointerMove={onMove}
              onPointerUp={end}
              onPointerCancel={end}
            >
              {/* Rule of thirds. */}
              {[1, 2].map((i) => (
                <span key={`v${i}`} className="pointer-events-none absolute inset-y-0 w-px bg-zinc-100/25" style={{ left: `${(i * 100) / 3}%` }} />
              ))}
              {[1, 2].map((i) => (
                <span key={`h${i}`} className="pointer-events-none absolute inset-x-0 h-px bg-zinc-100/25" style={{ top: `${(i * 100) / 3}%` }} />
              ))}
            </div>
          </div>

          {/* Outline and handles sit outside the clipping box so they stay visible and grabbable at the image edges. */}
          <div
            className="pointer-events-none absolute outline outline-zinc-100"
            style={{ left: left + crop.x * dw, top: top + crop.y * dh, width: crop.width * dw, height: crop.height * dh }}
          >
            {HANDLES.map((h) => (
              <span
                key={h.id}
                data-handle={h.id}
                aria-hidden
                className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 touch-none border border-zinc-950 bg-zinc-100"
                style={{ ...h.style, cursor: h.cursor }}
                onPointerDown={begin(h.id)}
                onPointerMove={onMove}
                onPointerUp={end}
                onPointerCancel={end}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
