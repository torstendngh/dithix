"use client";

import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { Switch } from "@/components/shared/switch";
import { bandSizes } from "@/lib/dither/gradient";
import type { GradientDirection } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, IconButton, NumberInput, Segmented, SliderField } from "../fields";
import { Section } from "../section";

const DIRECTIONS: { value: GradientDirection; icon: IconName; title: string }[] = [
  { value: "right", icon: "arrow-right", title: "Left to right" },
  { value: "left", icon: "arrow-left", title: "Right to left" },
  { value: "down", icon: "arrow-down", title: "Top to bottom" },
  { value: "up", icon: "arrow-up", title: "Bottom to top" },
  { value: "radial", icon: "radial", title: "Centre outwards" },
];

export function GradientPanel() {
  const gradient = useSettingsStore((s) => s.settings.gradient);
  const setGradient = useSettingsStore((s) => s.setGradient);
  const off = !gradient.enabled;

  return (
    <Section
      title="Glitch gradient"
      defaultOpen={false}
      icon="gradient"
      actions={
        <Switch
          aria-label="Enable glitch gradient"
          checked={gradient.enabled}
          onCheckedChange={(enabled) => setGradient({ enabled })}
        />
      }
    >
      <p className="text-2xs leading-relaxed text-zinc-600">
        Dots grow from start to end size in bands. Sizes are in output pixels — raise the resolution
        for a finer start.
      </p>

      <div className={cn("grid gap-3", off && "pointer-events-none opacity-40")} aria-disabled={off}>
        <Segmented
          aria-label="Gradient direction"
          value={gradient.direction}
          options={DIRECTIONS.map(({ value, icon, title }) => ({
            value,
            title,
            label: <PixelIcon name={icon} scale={1} />,
          }))}
          onChange={(direction) => setGradient({ direction })}
        />
        <SliderField
          label="Start dot"
          value={gradient.startSize}
          onChange={(startSize) => setGradient({ startSize })}
          min={1}
          max={32}
          defaultValue={1}
          unit="px"
        />
        <SliderField
          label="End dot"
          value={gradient.endSize}
          onChange={(endSize) => setGradient({ endSize })}
          min={1}
          max={32}
          defaultValue={8}
          unit="px"
        />
        <SliderField
          label="Bands"
          value={gradient.bands}
          onChange={(bands) => setGradient({ bands })}
          min={2}
          max={24}
          defaultValue={6}
        />
        <div className="flex h-3 border border-zinc-800" aria-hidden title="Dot size per band">
          {bandSizes(gradient).map((size, i, all) => {
            const max = Math.max(...all);
            const min = Math.min(...all);
            const shade = max === min ? 0.5 : (size - min) / (max - min);
            return (
              <span
                key={i}
                className="flex-1 border-r border-zinc-950 last:border-r-0"
                style={{ background: `color-mix(in oklab, var(--color-zinc-200) ${Math.round(15 + shade * 70)}%, transparent)` }}
              />
            );
          })}
        </div>
        <SliderField
          label="Scatter"
          value={gradient.scatter}
          onChange={(scatter) => setGradient({ scatter })}
          min={0}
          max={1}
          step={0.01}
          display={100}
          defaultValue={0.35}
          unit="%"
        />
        <FieldRow label="Seed">
          <div className="flex items-center gap-1">
            <NumberInput
              aria-label="Gradient seed"
              value={gradient.seed}
              onValueChange={(seed) => setGradient({ seed: Math.round(seed) })}
              min={0}
              max={99999}
            />
            <IconButton
              icon="dice"
              label="Random seed"
              size="icon-xs"
              onClick={() => setGradient({ seed: Math.floor(Math.random() * 99999) })}
            />
          </div>
        </FieldRow>
        <SliderField
          label="From"
          value={gradient.from}
          onChange={(from) => setGradient({ from })}
          min={0}
          max={1}
          step={0.01}
          display={100}
          defaultValue={0}
          unit="%"
        />
        <SliderField
          label="To"
          value={gradient.to}
          onChange={(to) => setGradient({ to })}
          min={0}
          max={1}
          step={0.01}
          display={100}
          defaultValue={1}
          unit="%"
        />
        <FieldRow label="Fade from original">
          <Switch
            aria-label="Fade from original"
            checked={gradient.fadeIn}
            onCheckedChange={(fadeIn) => setGradient({ fadeIn })}
          />
        </FieldRow>
      </div>
    </Section>
  );
}
