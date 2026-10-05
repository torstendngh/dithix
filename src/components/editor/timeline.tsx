"use client";

import { useRef, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Switch } from "@/components/shared/switch";
import { EASINGS, isDiscrete, keyIndexAt, readPath, trackLabel, valueAt } from "@/lib/dither/keyframes";
import { frameCount } from "@/lib/dither/motion";
import type { MotionTrack } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { IconButton } from "./fields";

/** Width of the track-name column; the playhead overlay is offset by it. */
const LABEL_W = "w-48";
const LABEL_OFFSET = "left-48";

type Selected = { path: string; t: number } | null;

/** Frame under a pointer over a lane or the ruler. */
function frameAt(e: React.PointerEvent | PointerEvent, el: HTMLElement, n: number): number {
  const r = el.getBoundingClientRect();
  const u = (e.clientX - r.left) / Math.max(1, r.width);
  return Math.min(n - 1, Math.max(0, Math.round(u * n)));
}

/** Pauses playback and drags the playhead along with the pointer. */
function useScrub(n: number) {
  const setPlayhead = useWorkspaceStore((s) => s.setPlayhead);
  const setPlaying = useWorkspaceStore((s) => s.setPlaying);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPlaying(false);
      setPlayhead(frameAt(e, e.currentTarget, n));
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) setPlayhead(frameAt(e, e.currentTarget, n));
    },
  };
}

function Ruler({ n, fps }: { n: number; fps: number }) {
  const scrub = useScrub(n);
  const seconds = Math.floor((n - 1) / fps);
  return (
    <div className="relative h-6 cursor-ew-resize touch-none border-b border-zinc-800 select-none" {...scrub}>
      {n <= 120 &&
        Array.from({ length: n }, (_, i) => (
          <span key={i} className="absolute bottom-0 h-1 w-px bg-zinc-800" style={{ left: `${(i / n) * 100}%` }} />
        ))}
      {Array.from({ length: seconds + 1 }, (_, s) => (
        <span key={s} className="absolute inset-y-0 border-l border-zinc-700 pl-1 text-2xs leading-6 text-zinc-500" style={{ left: `${((s * fps) / n) * 100}%` }}>
          {s}s
        </span>
      ))}
    </div>
  );
}

/** The track's value over the loop, scaled to its own key range. */
function TrackCurve({ track, discrete }: { track: MotionTrack; discrete: boolean }) {
  const values = track.keys.map((k) => k.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (track.keys.length < 2 || hi === lo) {
    return <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-zinc-800" />;
  }
  const points = Array.from({ length: 129 }, (_, i) => {
    const t = i / 128;
    const v = valueAt(track, Math.min(t, 0.99999), discrete);
    return `${t * 100},${88 - ((v - lo) / (hi - lo)) * 76}`;
  }).join(" ");
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" className="stroke-zinc-600" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrackRow({
  track,
  n,
  selected,
  onSelect,
}: {
  track: MotionTrack;
  n: number;
  selected: Selected;
  onSelect: (s: Selected) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const { setKeyframe, removeKeyframe, moveKeyframe, setTrackEasing, removeTrack } = useSettingsStore.getState();
  const playhead = useWorkspaceStore((s) => s.playhead) % n;
  const { setPlayhead, setPlaying } = useWorkspaceStore.getState();
  const scrub = useScrub(n);
  const laneRef = useRef<HTMLDivElement>(null);
  /** A key being dragged: where it started and the frame it is over now. */
  const [drag, setDrag] = useState<{ t: number; frame: number } | null>(null);

  const t = playhead / n;
  const keyHere = keyIndexAt(track, t) >= 0;
  const label = trackLabel(settings, track.path);
  const discrete = isDiscrete(settings, track.path);
  const value = readPath(settings, track.path);
  const easing = EASINGS.find((e) => e.value === track.easing) ?? EASINGS[0];
  const nextEasing = EASINGS[(EASINGS.indexOf(easing) + 1) % EASINGS.length];

  const beginKey = (keyT: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPlaying(false);
    const frame = Math.round(keyT * n);
    setDrag({ t: keyT, frame });
    setPlayhead(frame);
    onSelect({ path: track.path, t: keyT });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag || !laneRef.current) return;
    const frame = frameAt(e, laneRef.current, n);
    if (frame !== drag.frame) {
      setDrag({ ...drag, frame });
      setPlayhead(frame);
    }
  };
  const endDrag = () => {
    if (!drag) return;
    const to = drag.frame / n;
    if (Math.abs(to - drag.t) > 1e-9) {
      moveKeyframe(track.path, drag.t, to);
      onSelect({ path: track.path, t: to });
    }
    setDrag(null);
  };

  return (
    <div className="flex h-7 border-b border-zinc-900">
      <div className={cn(LABEL_W, "flex shrink-0 items-center gap-1 border-r border-zinc-800 pr-1 pl-2")}>
        <button
          type="button"
          aria-label={keyHere ? `Remove ${label} keyframe at playhead` : `Key ${label} at playhead`}
          title={keyHere ? "Remove keyframe at playhead" : "Keyframe the current value at the playhead"}
          onClick={() => (keyHere ? removeKeyframe(track.path, t) : setKeyframe(track.path, t))}
          className={cn("grid size-5 shrink-0 place-items-center outline-none hover:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-ring", keyHere ? "text-amber-300" : "text-zinc-600")}
        >
          <PixelIcon name="keyframe" scale={1} />
        </button>
        <span className="min-w-0 flex-1 truncate text-zinc-300" title={label}>
          {label}
        </span>
        <span className="text-2xs text-zinc-500 tabular-nums">{value === undefined ? "" : Math.round(value * 100) / 100}</span>
        <button
          type="button"
          title={`${easing.label} — click for ${nextEasing.label.toLowerCase()}`}
          onClick={() => setTrackEasing(track.path, nextEasing.value)}
          className="h-5 w-11 shrink-0 text-2xs text-zinc-500 outline-none hover:bg-zinc-900 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-ring"
        >
          {easing.label}
        </button>
        <IconButton icon="trash" label={`Remove ${label} track`} size="icon-xs" onClick={() => removeTrack(track.path)} />
      </div>
      <div ref={laneRef} className="relative min-w-0 flex-1 cursor-ew-resize touch-none select-none" {...scrub}>
        <TrackCurve track={track} discrete={discrete} />
        {track.keys.map((k) => {
          const dragging = drag && Math.abs(drag.t - k.t) < 1e-9;
          const x = dragging ? drag.frame / n : k.t;
          const isSelected = selected?.path === track.path && Math.abs(selected.t - k.t) < 1e-9;
          return (
            <span
              key={k.t}
              role="button"
              aria-label={`${label} keyframe at frame ${Math.round(k.t * n) + 1}: ${Math.round(k.value * 100) / 100}`}
              title={`${Math.round(k.value * 100) / 100} · drag to move, Delete to remove`}
              className={cn(
                "absolute top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center",
                isSelected ? "text-amber-300" : "text-zinc-200 hover:text-white",
              )}
              style={{ left: `${x * 100}%` }}
              onPointerDown={beginKey(k.t)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <PixelIcon name="keyframe" scale={1} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function KeyLastChange({ t }: { t: number }) {
  const lastChange = useWorkspaceStore((s) => s.lastChange);
  const settings = useSettingsStore((s) => s.settings);
  const setKeyframe = useSettingsStore((s) => s.setKeyframe);
  const valid = lastChange !== null && readPath(settings, lastChange) !== undefined;
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={!valid}
      onClick={() => valid && setKeyframe(lastChange, t)}
      title="Keyframe the setting you changed last, at the playhead (K)"
      className="max-w-72 normal-case"
    >
      <PixelIcon name="keyframe" scale={1} className="text-amber-300" />
      <span className="truncate">{valid ? `Key ${trackLabel(settings, lastChange)}` : "Key last change"}</span>
    </Button>
  );
}

const ISLAND = "flex h-[30px] shrink-0 items-center border border-zinc-800 bg-zinc-950/90 backdrop-blur";

/**
 * The timeline while it is off: floating islands in the viewport, play/pause (and render
 * progress) whenever Motion still makes a loop, and one that turns the timeline on.
 */
export function TimelineIsland() {
  const hasImage = useWorkspaceStore((s) => s.source !== null);
  const on = useSettingsStore((s) => s.settings.motion.keyframes);
  const motion = useSettingsStore((s) => s.settings.motion.enabled);
  const tracks = useSettingsStore((s) => s.settings.motion.tracks.length);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const playing = useWorkspaceStore((s) => s.playing);
  const setPlaying = useWorkspaceStore((s) => s.setPlaying);
  const done = useWorkspaceStore((s) => s.frames.length);
  const total = useWorkspaceStore((s) => s.frameTotal);
  if (!hasImage || on) return null;
  const rendering = total > 0 && done < total;
  return (
    <>
      {motion && (
        <div className={ISLAND}>
          <IconButton
            icon={playing ? "pause" : "play"}
            label={playing ? "Pause animation" : "Play animation"}
            aria-pressed={playing}
            onClick={() => setPlaying(!playing)}
          />
          {rendering && (
            <span className="pr-1.5 text-2xs text-zinc-500 tabular-nums" title="Rendering animation frames">
              {done}/{total}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setMotion({ keyframes: true })}
        title="Turn on the timeline to animate with keyframes"
        className={cn(
          ISLAND,
          "gap-2 px-2.5 text-2xs text-zinc-400 outline-none hover:border-zinc-600 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <PixelIcon name="keyframe" scale={1} className="text-amber-300" />
        Timeline
        {tracks > 0 && <span className="text-zinc-600 tabular-nums">{tracks}</span>}
      </button>
    </>
  );
}

/** Video-editor style timeline under the viewport: playback, scrubbing and keyframe tracks. */
export function Timeline() {
  const hasImage = useWorkspaceStore((s) => s.source !== null);
  const motion = useSettingsStore((s) => s.settings.motion);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const removeKeyframe = useSettingsStore((s) => s.removeKeyframe);
  const playing = useWorkspaceStore((s) => s.playing);
  const setPlaying = useWorkspaceStore((s) => s.setPlaying);
  const setPlayhead = useWorkspaceStore((s) => s.setPlayhead);
  const done = useWorkspaceStore((s) => s.frames.length);
  const total = useWorkspaceStore((s) => s.frameTotal);
  const n = frameCount(motion);
  const playhead = useWorkspaceStore((s) => s.playhead) % n;
  const [selected, setSelected] = useState<Selected>(null);

  if (!hasImage || !motion.keyframes) return null;

  const rendering = total > 0 && done < total;
  const step = (d: number) => {
    setPlaying(false);
    setPlayhead((playhead + d + n) % n);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      removeKeyframe(selected.path, selected.t);
      setSelected(null);
    }
  };

  return (
    <div
      className="flex max-h-[40%] shrink-0 flex-col border-t border-zinc-800 bg-zinc-950 outline-none"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label="Timeline"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800 px-2">
        <Switch
          size="sm"
          aria-label="Timeline"
          title="Turn the timeline off (keyframes stop playing)"
          checked
          onCheckedChange={(keyframes) => setMotion({ keyframes })}
          className="mr-1.5 ml-1"
        />
        <IconButton icon="arrow-left" label="Previous frame (,)" onClick={() => step(-1)} />
        <IconButton
          icon={playing ? "pause" : "play"}
          label={playing ? "Pause" : "Play"}
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        />
        <IconButton icon="arrow-right" label="Next frame (.)" onClick={() => step(1)} />
        <span className="ml-1 text-2xs text-zinc-300 tabular-nums">
          {String(playhead + 1).padStart(String(n).length, "0")}/{n}
        </span>
        <span className="text-2xs text-zinc-600 tabular-nums">
          {(playhead / motion.fps).toFixed(2)}s / {(n / motion.fps).toFixed(2)}s
        </span>
        {rendering && (
          <span className="ml-2 text-2xs text-amber-400/90 tabular-nums" title="Rendering animation frames">
            rendering {done}/{total}
          </span>
        )}
        <div className="ml-auto">
          <KeyLastChange t={playhead / n} />
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="relative">
          <div className="flex">
            <div className={cn(LABEL_W, "flex h-6 shrink-0 items-center border-r border-b border-zinc-800 px-2 text-2xs tracking-[0.2em] text-zinc-600 uppercase")}>
              Keyframes
            </div>
            <div className="min-w-0 flex-1">
              <Ruler n={n} fps={motion.fps} />
            </div>
          </div>
          {motion.tracks.map((track) => (
            <TrackRow key={track.path} track={track} n={n} selected={selected} onSelect={setSelected} />
          ))}
          {motion.tracks.length === 0 && (
            <p className="px-3 py-3 text-2xs leading-relaxed text-zinc-600">
              Move the playhead, change a setting in the sidebar, then press{" "}
              <span className="text-zinc-400">Key</span> (K) to keyframe it. Once a setting has keyframes, changing it keys it at the
              playhead. The loop wraps from the last keyframe back to the first.
            </p>
          )}
          {/* Playhead, across the ruler and every track. */}
          <div className={cn("pointer-events-none absolute inset-y-0 right-0", LABEL_OFFSET)} aria-hidden>
            <span className="absolute inset-y-0 w-px bg-amber-300/80" style={{ left: `${(playhead / n) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
