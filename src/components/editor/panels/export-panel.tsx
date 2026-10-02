"use client";

import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import type { ExportFormat } from "@/lib/dither/types";
import { maxExportScale } from "@/lib/image-io";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { exportResult } from "../actions";
import { FieldRow, NumberInput, Segmented, SliderField } from "../fields";
import { Section } from "../section";

const FORMATS: { value: ExportFormat; label: string; title: string }[] = [
  { value: "png", label: "PNG", title: "Lossless raster" },
  { value: "jpg", label: "JPG", title: "Lossy raster, no transparency" },
  { value: "svg", label: "SVG", title: "Vector, one path per colour" },
];

const SCALES = [1, 2, 4, 8];

export function ExportPanel() {
  const exportSettings = useSettingsStore((s) => s.exportSettings);
  const setExport = useSettingsStore((s) => s.setExport);
  const result = useWorkspaceStore((s) => s.result);
  const maxScale = result ? maxExportScale(result.width, result.height) : 64;
  const scale = Math.min(exportSettings.scale, maxScale);

  return (
    <Section title="Export" icon="download">
      <Segmented
        aria-label="Export format"
        value={exportSettings.format}
        options={FORMATS}
        onChange={(format) => setExport({ format })}
      />
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
      <Button onClick={() => void exportResult()} disabled={!result} className="w-full">
        <PixelIcon name="download" />
        Download {exportSettings.format}
        {result && (
          <span className="opacity-60 normal-case">
            {result.width * scale}×{result.height * scale}
          </span>
        )}
      </Button>
    </Section>
  );
}
