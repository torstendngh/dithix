"use client";

import { useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { extractPalette, PALETTE_GROUPS, PALETTE_PRESETS } from "@/lib/dither/palettes";
import type { ColorDistance } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { MAX_PALETTE_COLORS, useSettingsStore } from "@/stores/settings-store";
import { usePaletteStore } from "@/stores/palette-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { FieldRow, Segmented } from "../fields";
import { LibraryPicker } from "../library-picker";
import { Section } from "../section";


const DISTANCES: { value: ColorDistance; label: string; title: string }[] = [
  { value: "rgb", label: "RGB", title: "Euclidean distance in RGB" },
  { value: "redmean", label: "Redmean", title: "Cheap perceptual weighting" },
  { value: "luma", label: "Luma", title: "Match brightness first, hue second" },
];

const EXTRACT_COUNTS = [2, 4, 8, 16];

function Strip({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span className={cn("flex h-3 w-16 shrink-0 border border-zinc-700", className)}>
      {colors.map((c, i) => (
        <span key={i} className="h-full flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

function Swatch({ color, index, removable }: { color: string; index: number; removable: boolean }) {
  const setPaletteColor = useSettingsStore((s) => s.setPaletteColor);
  const removePaletteColor = useSettingsStore((s) => s.removePaletteColor);
  return (
    <div className="group relative size-7">
      <label
        className="block size-full cursor-pointer border border-zinc-700 outline-none hover:border-zinc-300 has-focus-visible:border-zinc-100"
        style={{ background: color }}
        title={`${color} — click to edit${removable ? ", right-click to remove" : ""}`}
        onContextMenu={(e) => {
          e.preventDefault();
          if (removable) removePaletteColor(index);
        }}
      >
        <input
          type="color"
          value={color}
          onChange={(e) => setPaletteColor(index, e.target.value)}
          className="sr-only"
          aria-label={`Palette colour ${index + 1}`}
        />
      </label>
      {removable && (
        <button
          type="button"
          onClick={() => removePaletteColor(index)}
          aria-label={`Remove ${color}`}
          className="absolute -top-1 -right-1 hidden size-3.5 place-items-center border border-zinc-600 bg-zinc-950 text-zinc-300 group-hover:grid hover:bg-zinc-100 hover:text-zinc-950"
        >
          <PixelIcon name="close" scale={1} className="size-2" />
        </button>
      )}
    </div>
  );
}

const sameColors = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());

/** Palette manager: built-in palettes plus the user's saved ones. */
function PalettePicker() {
  const palette = useSettingsStore((s) => s.settings.palette);
  const setPalettePreset = useSettingsStore((s) => s.setPalettePreset);
  const setPaletteColors = useSettingsStore((s) => s.setPaletteColors);
  const saved = usePaletteStore((s) => s.palettes);
  const { savePalette, overwritePalette, renamePalette, deletePalette } = usePaletteStore.getState();

  // Built-ins are tracked by id; saved palettes match when the colours are identical.
  const activeId =
    palette.presetId ?? saved.find((p) => sameColors(p.colors, palette.colors))?.id ?? null;

  return (
    <LibraryPicker
      noun="palette"
      icon="palette"
      triggerLabel="Palette preset"
      current="colours"
      saved={saved.map((p) => ({ id: p.id, name: p.name, preview: <Strip colors={p.colors} /> }))}
      builtIn={PALETTE_GROUPS.map((g) => ({
        label: g.label,
        items: PALETTE_PRESETS.filter((p) => p.group === g.id).map((p) => ({
          id: p.id,
          name: p.name,
          preview: <Strip colors={p.colors} />,
        })),
      }))}
      activeId={activeId}
      triggerPreview={<Strip colors={palette.colors} />}
      onApply={(id) => {
        const own = saved.find((p) => p.id === id);
        if (own) setPaletteColors(own.colors);
        else setPalettePreset(id);
      }}
      onSave={(name) => savePalette(name, useSettingsStore.getState().settings.palette.colors)}
      onOverwrite={(id) => overwritePalette(id, useSettingsStore.getState().settings.palette.colors)}
      onRename={renamePalette}
      onDelete={deletePalette}
    />
  );
}

export function PalettePanel() {
  const palette = useSettingsStore((s) => s.settings.palette);
  const setPaletteColors = useSettingsStore((s) => s.setPaletteColors);
  const addPaletteColor = useSettingsStore((s) => s.addPaletteColor);
  const setColorDistance = useSettingsStore((s) => s.setColorDistance);
  const sample = useWorkspaceStore((s) => s.source?.sample);
  const [extractCount, setExtractCount] = useState(4);

  return (
    <Section title="Palette" icon="palette">
      <PalettePicker />

      <div className="flex flex-wrap gap-1.5">
        {palette.colors.map((c, i) => (
          <Swatch key={i} color={c} index={i} removable={palette.colors.length > 1} />
        ))}
        {palette.colors.length < MAX_PALETTE_COLORS && (
          <button
            type="button"
            onClick={() => addPaletteColor("#808080")}
            aria-label="Add colour"
            title="Add colour"
            className="grid size-7 place-items-center border border-dashed border-zinc-700 text-zinc-500 outline-none hover:border-zinc-400 hover:text-zinc-100 focus-visible:border-zinc-100"
          >
            <PixelIcon name="plus" scale={1} />
          </button>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className="text-zinc-400">Extract from image</span>
        <div className="flex gap-1">
          <Segmented
            aria-label="Colours to extract"
            value={extractCount}
            options={EXTRACT_COUNTS.map((n) => ({ value: n, label: n }))}
            onChange={setExtractCount}
          />
          <Button
            variant="secondary"
            size="xs"
            disabled={!sample}
            onClick={() => sample && setPaletteColors(extractPalette(sample, extractCount))}
          >
            <PixelIcon name="wand" scale={1} />
            Extract
          </Button>
        </div>
      </div>

      <FieldRow label="Match">
        <Segmented
          aria-label="Colour distance"
          className="w-auto"
          value={palette.distance}
          options={DISTANCES}
          onChange={setColorDistance}
        />
      </FieldRow>
    </Section>
  );
}
