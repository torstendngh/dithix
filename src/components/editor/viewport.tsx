"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/tailwind-utils";
import { isFullCrop } from "@/lib/crop-math";
import { frameLayout } from "@/lib/dither/frame";
import { wheelZoomFactor } from "@/lib/viewport-math";
import { useSettingsStore } from "@/stores/settings-store";
import { currentView, useWorkspaceStore } from "@/stores/workspace-store";
import { openImage, openSample, pickImage } from "./actions";
import { IconButton } from "./fields";
import { StatusBar } from "./status-bar";

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <PixelIcon name="image" scale={8} className="text-zinc-800" />
      <div className="grid gap-1">
        <p className="text-sm text-zinc-200">Drop an image to start dithering</p>
        <p className="text-zinc-500">or paste from clipboard · ⌘O to browse</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={pickImage}>
          <PixelIcon name="upload" />
          Open image
        </Button>
        <Button variant="outline" onClick={() => void openSample()}>
          <PixelIcon name="wand" />
          Try sample
        </Button>
      </div>
    </div>
  );
}

/** Play/pause for the motion loop, with render progress while frames are still coming in. */
function PlaybackControl() {
  const playing = useWorkspaceStore((s) => s.playing);
  const setPlaying = useWorkspaceStore((s) => s.setPlaying);
  const done = useWorkspaceStore((s) => s.frames.length);
  const total = useWorkspaceStore((s) => s.frameTotal);
  const rendering = total > 0 && done < total;
  return (
    <>
      <IconButton
        icon={playing ? "pause" : "play"}
        label={playing ? "Pause animation" : "Play animation"}
        aria-pressed={playing}
        onClick={() => setPlaying(!playing)}
      />
      {rendering && (
        <span className="px-1.5 text-2xs text-zinc-500 tabular-nums" title="Rendering animation frames">
          {done}/{total}
        </span>
      )}
      <span className="h-4 w-px bg-zinc-800" />
    </>
  );
}

function ZoomControls({ zoom }: { zoom: number }) {
  const fit = useWorkspaceStore((s) => s.fit);
  const fitView = useWorkspaceStore((s) => s.fitView);
  const zoomTo = useWorkspaceStore((s) => s.zoomTo);
  const stepZoom = useWorkspaceStore((s) => s.stepZoom);
  const compare = useWorkspaceStore((s) => s.compare);
  const setCompare = useWorkspaceStore((s) => s.setCompare);
  const motion = useSettingsStore((s) => s.settings.motion.enabled);
  const cropped = useWorkspaceStore((s) => !isFullCrop(s.crop));
  const setCropping = useWorkspaceStore((s) => s.setCropping);

  return (
    <div className="absolute right-3 bottom-3 flex items-center border border-zinc-800 bg-zinc-950/90 backdrop-blur">
      {motion && <PlaybackControl />}
      <IconButton icon="crop" label="Crop & pan (C)" aria-pressed={cropped} onClick={() => setCropping(true)} />
      <IconButton
        icon="eye"
        label="Hold to compare with original (Space)"
        aria-pressed={compare}
        onPointerDown={() => setCompare(true)}
        onPointerUp={() => setCompare(false)}
        onPointerLeave={() => setCompare(false)}
      />
      <span className="h-4 w-px bg-zinc-800" />
      <IconButton icon="minus" label="Zoom out (−)" onClick={() => stepZoom(-1)} />
      <button
        type="button"
        onClick={() => zoomTo(1)}
        title="Actual pixels (1)"
        className="h-7 w-14 text-center text-zinc-300 tabular-nums outline-none hover:bg-zinc-900 focus-visible:bg-zinc-900"
      >
        {zoom >= 10 ? Math.round(zoom * 100) : Math.round(zoom * 1000) / 10}%
      </button>
      <IconButton icon="plus" label="Zoom in (+)" onClick={() => stepZoom(1)} />
      <IconButton icon="fit" label="Fit to view (0 · double-click)" aria-pressed={fit} onClick={fitView} />
    </div>
  );
}

/**
 * Pan & zoom: wheel or pinch zooms toward the cursor, dragging pans (mouse, pen, one finger),
 * two fingers pinch-zoom, double-click fits.
 */
function useStageGestures(stageRef: React.RefObject<HTMLDivElement | null>) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [panning, setPanning] = useState(false);
  const ws = useWorkspaceStore.getState;

  /** Point relative to the viewport centre, which is what the store's anchors expect. */
  const fromCentre = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  // Native listener: React's wheel handler is passive, so it can't stop page zoom/scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!ws().result) return;
      ws().zoomBy(wheelZoomFactor(e.deltaY, e.deltaMode, e.ctrlKey), fromCentre(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ws().result || (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setPanning(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };

    if (map.size === 2) {
      const other = [...map].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      const midBefore = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      const midAfter = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
      if (before > 0) ws().zoomBy(after / before, fromCentre(midAfter.x, midAfter.y));
      ws().panBy(midAfter.x - midBefore.x, midAfter.y - midBefore.y);
    } else if (map.size === 1) {
      ws().panBy(next.x - prev.x, next.y - prev.y);
    }
    map.set(e.pointerId, next);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setPanning(false);
  };

  return {
    panning,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onDoubleClick: () => ws().fitView(),
    },
  };
}

export function Viewport() {
  const source = useWorkspaceStore((s) => s.source);
  const result = useWorkspaceStore((s) => s.result);
  const compare = useWorkspaceStore((s) => s.compare);
  const fit = useWorkspaceStore((s) => s.fit);
  const storedView = useWorkspaceStore((s) => s.view);
  const viewport = useWorkspaceStore((s) => s.viewport);
  const setViewport = useWorkspaceStore((s) => s.setViewport);
  const view = currentView({ fit, view: storedView, viewport, result });
  const frames = useWorkspaceStore((s) => s.frames);
  const frameTotal = useWorkspaceStore((s) => s.frameTotal);
  const playing = useWorkspaceStore((s) => s.playing);
  const motion = useSettingsStore((s) => s.settings.motion);
  const resize = useSettingsStore((s) => s.settings.resize);
  const padding = useSettingsStore((s) => s.settings.background.padding);
  const crop = useWorkspaceStore((s) => s.crop);
  // Play once the whole loop is in; until then (and while comparing) show the still.
  const loop = motion.enabled && playing && !compare && frameTotal > 0 && frames.length === frameTotal ? frames : null;

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const { panning, handlers } = useStageGestures(stageRef);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  // Draw the result, or the original resampled to the same grid while comparing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d")!;
    if (compare && source) {
      // Same framing as the result: the cropped region, inside the margin.
      const layout = frameLayout(source.width, source.height, resize, crop, padding);
      const k = result.width / layout.width;
      const { region, inner } = layout;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, result.width, result.height);
      ctx.drawImage(
        source.bitmap,
        region.x, region.y, region.width, region.height,
        layout.padding * k, layout.padding * k, inner.width * k, inner.height * k,
      );
    } else {
      ctx.putImageData(result, 0, 0);
    }
  }, [result, compare, source, resize, crop, padding]);

  // Motion loop playback, timed by the clock so it keeps its speed whatever the display rate.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loop) return;
    canvas.width = loop[0].width;
    canvas.height = loop[0].height;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    let shown = -1;
    let raf = 0;
    const tick = (now: number) => {
      const i = Math.floor(((now - start) / 1000) * motion.fps) % loop.length;
      if (i !== shown) {
        ctx.putImageData(loop[i], 0, 0);
        shown = i;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Back to the still when playback stops.
      if (result) {
        canvas.width = result.width;
        canvas.height = result.height;
        ctx.putImageData(result, 0, 0);
      }
    };
  }, [loop, motion.fps, result]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (file) void openImage(file, file.name);
  };

  // Whole-pixel placement keeps the pixelated upscale crisp.
  const w = result ? Math.max(1, Math.round(result.width * view.zoom)) : 0;
  const h = result ? Math.max(1, Math.round(result.height * view.zoom)) : 0;
  const left = Math.round(viewport.width / 2 + view.x - w / 2);
  const top = Math.round(viewport.height / 2 + view.y - h / 2);

  return (
    <div
      className="checkerboard relative min-h-0 min-w-0 flex-1 overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div
        ref={stageRef}
        data-testid="stage"
        className={cn(
          "absolute inset-0 touch-none select-none",
          result && (panning ? "cursor-grabbing" : "cursor-grab"),
        )}
        {...handlers}
      >
        {result && (
          <canvas
            ref={canvasRef}
            data-testid="result-canvas"
            className={cn("absolute block max-w-none", compare && "outline outline-zinc-500")}
            style={{ left, top, width: w, height: h, imageRendering: "pixelated" }}
          />
        )}
      </div>

      {!source && (
        <div className="absolute inset-0 grid place-items-center p-8">
          <EmptyState />
        </div>
      )}
      {source && !result && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center text-zinc-500">processing…</p>
      )}

      <StatusBar />
      {result && <ZoomControls zoom={view.zoom} />}
      {compare && result && (
        <span className="absolute top-3 left-3 bg-zinc-100 px-1.5 py-0.5 text-2xs tracking-widest text-zinc-950 uppercase">
          Original
        </span>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-3 grid place-items-center border-2 border-dashed border-zinc-300 bg-zinc-950/80">
          <div className="flex flex-col items-center gap-3 text-zinc-200">
            <PixelIcon name="upload" scale={4} />
            Drop to open
          </div>
        </div>
      )}
    </div>
  );
}
