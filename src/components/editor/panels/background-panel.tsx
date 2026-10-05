"use client";

import { BACKGROUND_MODES } from "@/lib/dither/background";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, SliderField } from "../fields";
import { ColorPicker } from "../color-picker";
import { PatternEditor } from "../pattern-editor";
import { Section } from "../section";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  // Palette colours as quick picks: a background in palette colours survives the dither intact.
  const palette = useSettingsStore((s) => s.settings.palette.colors);
  return (
    <FieldRow label={label}>
      <ColorPicker
        value={value}
        onChange={onChange}
        label={label}
        palette={palette}
        trigger={
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="flex h-6 cursor-pointer items-center gap-2 border border-zinc-700 pr-2 outline-none hover:border-zinc-500 focus-visible:border-zinc-100 data-popup-open:border-zinc-400"
            title="Click to pick a colour"
          >
            <span className="h-full w-6 border-r border-zinc-700" style={{ background: value }} />
            <span className="text-zinc-300 tabular-nums">{value}</span>
          </button>
        }
      />
    </FieldRow>
  );
}

export function BackgroundPanel() {
  const bg = useSettingsStore((s) => s.settings.background);
  const setBackground = useSettingsStore((s) => s.setBackground);
  const patterned = !["solid", "gradient", "pattern"].includes(bg.mode);
  const off = !bg.enabled;

  return (
    <Section
      id="background"
      title="Background"
      icon="background"
      actions={
        <Switch
          aria-label="Enable background"
          checked={bg.enabled}
          onCheckedChange={(enabled) => setBackground({ enabled })}
        />
      }
    >
      <p className="text-2xs leading-relaxed text-zinc-600">
        Fills transparent areas and the margin before dithering, so the fill comes out in your palette.
      </p>
      {/* Margin works with the fill off too (it then stays transparent). */}
      <SliderField
        label="Margin"
        value={bg.padding}
        onChange={(padding) => setBackground({ padding: Math.round(padding) })}
        min={0}
        max={128}
        defaultValue={0}
        unit="px"
      />
      <div className={cn("grid gap-3", off && "pointer-events-none opacity-40")} aria-disabled={off}>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Background fill">
          {BACKGROUND_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={bg.mode === m.value}
              onClick={() => setBackground({ mode: m.value })}
              className={cn(
                "h-6 border text-2xs outline-none focus-visible:border-zinc-400",
                bg.mode === m.value
                  ? "border-zinc-500 bg-zinc-800 text-zinc-50"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ColorField
          label={bg.mode === "gradient" ? "Top" : "Colour"}
          value={bg.colorA}
          onChange={(colorA) => setBackground({ colorA })}
        />
        {bg.mode !== "solid" && (
          <ColorField
            label={bg.mode === "gradient" ? "Bottom" : "Pattern"}
            value={bg.colorB}
            onChange={(colorB) => setBackground({ colorB })}
          />
        )}
        {patterned && (
          <SliderField
            label="Size"
            value={bg.size}
            onChange={(size) => setBackground({ size: Math.round(size) })}
            min={2}
            max={64}
            defaultValue={8}
            unit="px"
          />
        )}
        {bg.mode === "pattern" && (
          <PatternEditor
            pattern={bg.pattern}
            colorA={bg.colorA}
            colorB={bg.colorB}
            onChange={(pattern) => setBackground({ pattern })}
          />
        )}
      </div>
    </Section>
  );
}
