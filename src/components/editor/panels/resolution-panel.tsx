"use client";

import { computeOutputSize, MAX_DIMENSION } from "@/lib/dither/resize";
import type { ResizeMode } from "@/lib/dither/types";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { FieldRow, NumberInput, Segmented, SliderField } from "../fields";
import { Section } from "../section";

const MODES: { value: ResizeMode; label: string; title: string }[] = [
  { value: "scale", label: "Scale", title: "Percent of the source size" },
  { value: "width", label: "Width", title: "Fixed output width in pixels" },
  { value: "height", label: "Height", title: "Fixed output height in pixels" },
];

const WIDTH_PRESETS = [64, 128, 160, 256, 320, 512, 800];

export function ResolutionPanel() {
  const resize = useSettingsStore((s) => s.settings.resize);
  const setResize = useSettingsStore((s) => s.setResize);
  const source = useWorkspaceStore((s) => s.source);
  const out = source ? computeOutputSize(source.width, source.height, resize) : null;
  const pixelSize = source && out ? source.width / out.width : null;

  return (
    <Section title="Resolution" icon="resize">
      <Segmented
        aria-label="Resize mode"
        value={resize.mode}
        options={MODES}
        onChange={(mode) => setResize({ mode })}
      />

      {resize.mode === "scale" && (
        <SliderField
          label="Scale"
          value={resize.scale}
          onChange={(scale) => setResize({ scale })}
          min={1}
          max={100}
          defaultValue={50}
          unit="%"
        />
      )}

      {resize.mode !== "scale" && (
        <>
          <FieldRow label={resize.mode === "width" ? "Width" : "Height"}>
            <div className="flex items-center gap-1">
              <NumberInput
                aria-label={resize.mode === "width" ? "Output width" : "Output height"}
                className="w-20"
                value={resize.mode === "width" ? resize.width : resize.height}
                onValueChange={(v) => setResize({ [resize.mode]: Math.round(v) })}
                min={1}
                max={MAX_DIMENSION}
              />
              <span className="w-4 text-2xs text-zinc-600">px</span>
            </div>
          </FieldRow>
          <div className="flex flex-wrap gap-1">
            {WIDTH_PRESETS.map((n) => {
              const active = (resize.mode === "width" ? resize.width : resize.height) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setResize({ [resize.mode]: n })}
                  className={
                    "h-5 border px-1.5 text-2xs tabular-nums outline-none focus-visible:border-zinc-400 " +
                    (active
                      ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100")
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
        </>
      )}

      <FieldRow label="Filter">
        <Segmented
          aria-label="Resize filter"
          className="w-auto"
          value={resize.filter}
          options={[
            { value: "area", label: "Smooth", title: "Area average — every source pixel counts" },
            { value: "bilinear", label: "Sharp", title: "Bilinear — crisper, can alias" },
            { value: "canvas", label: "Browser", title: "Browser canvas resize — matches tools like doodad.dev" },
          ]}
          onChange={(filter) => setResize({ filter })}
        />
      </FieldRow>

      <div className="flex justify-between border border-dashed border-zinc-800 px-2 py-1.5 text-2xs text-zinc-500 tabular-nums">
        <span>output</span>
        <span className="text-zinc-300">
          {out ? `${out.width} × ${out.height}` : "—"}
          {pixelSize && pixelSize > 1 && <span className="text-zinc-600"> · {pixelSize.toFixed(1)}px/dot</span>}
        </span>
      </div>
    </Section>
  );
}
