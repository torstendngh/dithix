"use client";

import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { PixelText } from "@/components/icons/pixel-text";
import { Switch } from "@/components/shared/switch";
import { getAlgorithm } from "@/lib/dither/algorithms";
import { frameCount, MOTION_FPS } from "@/lib/dither/motion";
import type { CrawlDirection } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { FieldRow, Segmented, SliderField } from "../fields";
import { Section } from "../section";

const DIRECTIONS: { value: CrawlDirection; icon: IconName; title: string }[] = [
  { value: "right", icon: "arrow-right", title: "Crawl right" },
  { value: "left", icon: "arrow-left", title: "Crawl left" },
  { value: "down", icon: "arrow-down", title: "Crawl down" },
  { value: "up", icon: "arrow-up", title: "Crawl up" },
];

/** Rendering progress for the loop, or its length once done. */
function LoopStatus() {
  const done = useWorkspaceStore((s) => s.frames.length);
  const total = useWorkspaceStore((s) => s.frameTotal);
  const hasImage = useWorkspaceStore((s) => s.source !== null);
  const motion = useSettingsStore((s) => s.settings.motion);
  const frames = frameCount(motion);
  const rendering = total > 0 && done < total;

  return (
    <div className="grid gap-1.5 border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
      <div className="flex items-center justify-between text-2xs">
        <span className="text-zinc-300">
          {frames} frames · {(frames / motion.fps).toFixed(2).replace(/\.?0+$/, "")}s loop
        </span>
        <span className="text-zinc-500 tabular-nums">
          {!hasImage ? "open an image" : rendering ? `rendering ${done}/${total}` : total ? "ready" : "waiting…"}
        </span>
      </div>
      <div className="h-1 bg-zinc-800" aria-hidden>
        <div
          className={cn("h-full transition-[width]", rendering ? "bg-amber-400" : "bg-emerald-400")}
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

export function MotionPanel() {
  const motion = useSettingsStore((s) => s.settings.motion);
  const algorithm = useSettingsStore((s) => s.settings.dither.algorithm);
  const hasFilters = useSettingsStore((s) => s.settings.filters.some((f) => f.enabled));
  const setMotion = useSettingsStore((s) => s.setMotion);
  const off = !motion.enabled;
  const ordered = getAlgorithm(algorithm).kind === "ordered";
  const still = !motion.crawl && !motion.hueTurns && !motion.pulse && !motion.boil && !(motion.animateFilters && hasFilters);

  return (
    <Section
      id="motion"
      title="Motion"
      icon="motion"
      actions={
        <Switch aria-label="Enable motion" checked={motion.enabled} onCheckedChange={(enabled) => setMotion({ enabled })} />
      }
    >
      <p className="text-2xs leading-relaxed text-zinc-600">
        Turns the image into a seamless loop. Export it as GIF, MP4 or animated SVG.
      </p>

      <div className={cn("grid gap-3", off && "pointer-events-none opacity-40")} aria-disabled={off}>
        {!off && <LoopStatus />}

        <SliderField
          label="Length"
          value={motion.duration}
          onChange={(duration) => setMotion({ duration })}
          min={0.5}
          max={10}
          step={0.1}
          defaultValue={2}
          unit="s"
        />
        <FieldRow label="Frame rate">
          <Segmented
            aria-label="Frame rate"
            className="w-auto"
            value={motion.fps}
            options={MOTION_FPS.map((fps) => ({ value: fps, label: <PixelText>{String(fps)}</PixelText>, title: `${fps} frames per second` }))}
            onChange={(fps) => setMotion({ fps })}
          />
        </FieldRow>

        <div className="grid gap-2 border-t border-zinc-800 pt-3">
          <SliderField
            label="Pattern crawl"
            value={motion.crawl}
            onChange={(crawl) => setMotion({ crawl: Math.round(crawl) })}
            min={0}
            max={4}
            defaultValue={1}
            unit="px"
          />
          <Segmented
            aria-label="Crawl direction"
            value={motion.crawlDirection}
            options={DIRECTIONS.map(({ value, icon, title }) => ({ value, title, label: <PixelIcon name={icon} scale={1} /> }))}
            onChange={(crawlDirection) => setMotion({ crawlDirection })}
          />
          {motion.crawl > 0 && !ordered && (
            <p className="text-2xs leading-relaxed text-amber-400/90">
              Crawl moves ordered patterns (Bayer, halftone, lines…). Pick one in Dither to see it.
            </p>
          )}
        </div>

        <div className="grid gap-3 border-t border-zinc-800 pt-3">
          <SliderField
            label="Hue cycle"
            value={motion.hueTurns}
            onChange={(hueTurns) => setMotion({ hueTurns: Math.round(hueTurns) })}
            min={-3}
            max={3}
            defaultValue={0}
            unit="×"
          />
          <SliderField
            label="Brightness pulse"
            value={motion.pulse}
            onChange={(pulse) => setMotion({ pulse: Math.round(pulse) })}
            min={0}
            max={60}
            defaultValue={0}
          />
          <SliderField
            label="Boil every"
            value={motion.boil}
            onChange={(boil) => setMotion({ boil: Math.round(boil) })}
            min={0}
            max={12}
            defaultValue={0}
            unit="fr"
          />
          <FieldRow label="Animate filters">
            <Switch
              aria-label="Animate filters"
              checked={motion.animateFilters}
              onCheckedChange={(animateFilters) => setMotion({ animateFilters })}
            />
          </FieldRow>
        </div>

        <p className="text-2xs leading-relaxed text-zinc-600">
          {still
            ? "Nothing moves yet — add crawl, a hue cycle, pulse or boil, or a filter to animate."
            : "Boil re-rolls noise and glitch seeds. Animate filters rolls waves, swirls, RGB split and the TV glitch band."}
        </p>
      </div>
    </Section>
  );
}
