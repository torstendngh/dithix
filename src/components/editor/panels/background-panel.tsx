"use client";

import { BACKGROUND_MODES } from "@/lib/dither/background";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, SliderField } from "../fields";
import { Section } from "../section";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <FieldRow label={label}>
      <label
        className="flex h-6 cursor-pointer items-center gap-2 border border-zinc-700 pr-2 hover:border-zinc-500 has-focus-visible:border-zinc-100"
        title="Click to pick a colour"
      >
        <span className="h-full w-6 border-r border-zinc-700" style={{ background: value }} />
        <span className="text-zinc-300 tabular-nums">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-label={label}
        />
      </label>
    </FieldRow>
  );
}

export function BackgroundPanel() {
  const bg = useSettingsStore((s) => s.settings.background);
  const setBackground = useSettingsStore((s) => s.setBackground);
  const patterned = !["transparent", "solid", "gradient"].includes(bg.mode);

  return (
    <Section title="Background" icon="background" defaultOpen={false}>
      <p className="text-2xs leading-relaxed text-zinc-600">
        Fills transparent areas before dithering, so the fill comes out in your palette.
      </p>
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
      {bg.mode !== "transparent" && (
        <>
          <ColorField label={bg.mode === "gradient" ? "Top" : "Colour"} value={bg.colorA} onChange={(colorA) => setBackground({ colorA })} />
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
        </>
      )}
    </Section>
  );
}
