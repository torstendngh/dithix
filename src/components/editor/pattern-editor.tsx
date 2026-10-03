"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/shared/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { PATTERN_SIZES, PATTERN_SOURCES, patternFromMatrix, resizePattern } from "@/lib/dither/background";
import type { BackgroundPattern } from "@/lib/dither/types";
import { FieldRow, IconButton, Segmented, SliderField } from "./fields";

const SOURCE_ITEMS = Object.fromEntries(PATTERN_SOURCES.map((s) => [s.id, s.label]));

interface PatternEditorProps {
  pattern: BackgroundPattern;
  colorA: string;
  colorB: string;
  onChange: (pattern: BackgroundPattern) => void;
}

/**
 * Paintable tile for the custom background. Click or drag to paint; the stroke sets every cell
 * it crosses to the opposite of the cell it started on. Presets fill it from a threshold matrix.
 */
export function PatternEditor({ pattern, colorA, colorB, onChange }: PatternEditorProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // The value a drag paints, or null when not painting.
  const paint = useRef<"0" | "1" | null>(null);
  // Latest pattern during a drag, so quick strokes don't paint over each other's updates.
  const live = useRef(pattern);
  live.current = pattern;
  const [source, setSource] = useState("bayer4");
  const [density, setDensity] = useState(0.5);

  const { size, cells } = pattern;
  const sourceDef = PATTERN_SOURCES.find((s) => s.id === source)!;
  const sourceCells = sourceDef.build().ranks.length;

  const setCell = (i: number, value: "0" | "1") => {
    const p = live.current;
    if (p.cells[i] === value) return;
    const next = { ...p, cells: p.cells.slice(0, i) + value + p.cells.slice(i + 1) };
    live.current = next;
    onChange(next);
  };

  const cellAt = (e: React.PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
  };

  const loadPreset = (id: string, d: number) => {
    const def = PATTERN_SOURCES.find((s) => s.id === id)!;
    onChange(patternFromMatrix(def.build(), d, pattern.scale));
  };

  return (
    <div className="grid gap-3">
      <div
        ref={gridRef}
        role="grid"
        aria-label="Pattern tile"
        className="mx-auto grid aspect-square w-40 touch-none border border-zinc-700 select-none"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        onPointerDown={(e) => {
          const i = cellAt(e);
          if (i < 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          paint.current = cells[i] === "1" ? "0" : "1";
          setCell(i, paint.current);
        }}
        onPointerMove={(e) => {
          if (!paint.current) return;
          const i = cellAt(e);
          if (i >= 0) setCell(i, paint.current);
        }}
        onPointerUp={() => (paint.current = null)}
        onPointerCancel={() => (paint.current = null)}
      >
        {Array.from(cells, (c, i) => (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={`Cell ${(i % size) + 1}, ${Math.floor(i / size) + 1}`}
            aria-pressed={c === "1"}
            // Pointer painting is handled on the grid; this is for keyboard toggling only.
            onClick={(e) => e.detail === 0 && setCell(i, c === "1" ? "0" : "1")}
            className="outline-none focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-ring"
            style={{
              background: c === "1" ? colorB : colorA,
              boxShadow: size <= 8 ? "inset 0 0 0 0.5px rgb(0 0 0 / 0.35)" : undefined,
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="xs"
          onClick={() => onChange({ ...pattern, cells: Array.from(cells, (c) => (c === "1" ? "0" : "1")).join("") })}
        >
          Invert
        </Button>
        <Button variant="outline" size="xs" onClick={() => onChange({ ...pattern, cells: "0".repeat(size * size) })}>
          Clear
        </Button>
        <IconButton
          icon="dice"
          label="Random tile"
          size="icon-xs"
          onClick={() => onChange({ ...pattern, cells: Array.from(cells, () => (Math.random() < 0.5 ? "1" : "0")).join("") })}
        />
      </div>

      <FieldRow label="Tile">
        <Segmented
          aria-label="Tile size"
          className="w-auto"
          value={size}
          options={PATTERN_SIZES.map((s) => ({ value: s, label: String(s), title: `${s}×${s} cells` }))}
          onChange={(s) => onChange(resizePattern(pattern, s))}
        />
      </FieldRow>
      <SliderField
        label="Pixel size"
        value={pattern.scale}
        onChange={(scale) => onChange({ ...pattern, scale: Math.round(scale) })}
        min={1}
        max={16}
        defaultValue={1}
        unit="px"
      />

      <div className="grid gap-2 border-t border-zinc-800 pt-3">
        <span className="text-zinc-400">Preset</span>
        <Select
          items={SOURCE_ITEMS}
          value={source}
          onValueChange={(v) => {
            if (!v) return;
            setSource(v);
            loadPreset(v, density);
          }}
        >
          <SelectTrigger className="w-full" aria-label="Pattern preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {PATTERN_SOURCES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SliderField
          label="Density"
          value={density}
          onChange={(d) => {
            setDensity(d);
            loadPreset(source, d);
          }}
          min={0}
          max={1}
          step={1 / sourceCells}
          display={100}
          defaultValue={0.5}
          unit="%"
        />
        <p className="text-2xs leading-relaxed text-zinc-600">
          Picking a preset or density replaces the tile. Use palette colours so the pattern survives the dither.
        </p>
      </div>
    </div>
  );
}
