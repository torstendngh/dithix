"use client";

import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { frameCount, isLooping } from "@/lib/dither/motion";
import type { ExportFormat } from "@/lib/dither/types";
import { ANIMATED_FORMATS, maxExportScale } from "@/lib/image-io";
import { videoScale } from "@/lib/video";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { exportResult } from "../actions";
import { FieldRow, NumberInput, SliderField } from "../fields";
import { Section } from "../section";

const FORMATS: { value: ExportFormat; label: string; title: string; animated?: boolean }[] = [
  { value: "png", label: "PNG", title: "Lossless raster" },
  { value: "jpg", label: "JPG", title: "Lossy raster, no transparency" },
  { value: "svg", label: "SVG", title: "Vector, one path per colour — animated while Motion is on" },
  { value: "gif", label: "GIF", title: "Looping animation, exact palette colours", animated: true },
  { value: "mp4", label: "MP4", title: "Looping video, lossy, no transparency", animated: true },
];

/** WebCodecs video support, checked once in the browser. */
function useCanEncodeMp4() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/lib/video").then(({ canEncodeMp4 }) => canEncodeMp4()).then((v) => live && setOk(v), () => live && setOk(false));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}

const SCALES = [1, 2, 4, 8];

export function ExportPanel() {
  const exportSettings = useSettingsStore((s) => s.exportSettings);
  const setExport = useSettingsStore((s) => s.setExport);
  const result = useWorkspaceStore((s) => s.result);
  const done = useWorkspaceStore((s) => s.frames.length);
  const total = useWorkspaceStore((s) => s.frameTotal);
  const exporting = useWorkspaceStore((s) => s.exporting);
  const motion = useSettingsStore((s) => s.settings.motion);
  const mp4 = useCanEncodeMp4();
  const maxScale = result ? maxExportScale(result.width, result.height) : 64;
  const scale = Math.min(exportSettings.scale, maxScale);

  const format = exportSettings.format;
  const looping = isLooping(motion);
  const animated = looping && ANIMATED_FORMATS.includes(format);
  const needsMotion = !looping && (format === "gif" || format === "mp4");
  const rendering = animated && (total === 0 || done < total);
  const outScale = format === "mp4" && result ? videoScale(result.width, result.height, exportSettings.scale) : scale;
  const frames = frameCount(motion);

  return (
    <Section id="export" title="Export" icon="download">
      <div role="group" aria-label="Export format" className="flex w-full">
        {FORMATS.map((f, i) => {
          const unavailable = f.animated && (!looping || (f.value === "mp4" && mp4 === false));
          const why = !looping ? "Turn on Motion or the timeline to export animations" : "This browser can't encode video";
          return (
            <Button
              key={f.value}
              variant="outline"
              size="xs"
              title={unavailable ? why : f.title}
              aria-pressed={format === f.value}
              disabled={unavailable}
              onClick={() => setExport({ format: f.value })}
              className={cn("relative flex-1 normal-case aria-pressed:z-10 focus-visible:z-20", i > 0 && "-ml-px")}
            >
              {f.label}
            </Button>
          );
        })}
      </div>
      {animated && (
        <p className="text-2xs leading-relaxed text-zinc-600">
          {format === "gif" && `Looping GIF · ${frames} frames · exact palette colours.`}
          {format === "svg" && `Animated SVG · ${frames} frames. Large images make large files.`}
          {format === "mp4" && "MP4 · one loop, no transparency. Upscaled at least 2× so video compression keeps pixels crisp."}
        </p>
      )}
      {needsMotion && <p className="text-2xs leading-relaxed text-amber-400/90">Turn on Motion or the timeline to export {format.toUpperCase()}.</p>}
      <FieldRow label="Upscale">
        <div className="flex items-center gap-1">
          {SCALES.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="xs"
              aria-pressed={scale === s}
              disabled={s > maxScale}
              onClick={() => setExport({ scale: s })}
              className="w-8 px-0"
            >
              {s}×
            </Button>
          ))}
          <NumberInput
            aria-label="Custom upscale"
            value={exportSettings.scale}
            onValueChange={(v) => setExport({ scale: Math.round(v) })}
            min={1}
            max={64}
            className="w-10"
          />
        </div>
      </FieldRow>
      {exportSettings.format === "jpg" && (
        <SliderField
          label="Quality"
          value={exportSettings.quality}
          onChange={(quality) => setExport({ quality })}
          min={0.1}
          max={1}
          step={0.01}
          display={100}
          defaultValue={0.92}
          unit="%"
        />
      )}
      <Button
        onClick={() => void exportResult()}
        disabled={!result || needsMotion || rendering || exporting}
        className="w-full"
      >
        <PixelIcon name={animated ? "motion" : "download"} />
        {exporting ? "Encoding…" : rendering ? `Rendering ${done}/${total || frames}…` : `Download ${format}`}
        {result && !rendering && !exporting && (
          <span className="opacity-60 normal-case">
            {result.width * outScale}×{result.height * outScale}
          </span>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={() => useUiStore.getState().setPublishOpen(true)}
        disabled={!result}
        className="w-full"
        title="Share the result in the public gallery (reviewed before it appears)"
      >
        <PixelIcon name="gallery" />
        Publish to gallery
      </Button>
    </Section>
  );
}
