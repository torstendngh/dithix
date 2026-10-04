"use client";

import { Switch } from "@/components/shared/switch";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, IconButton, SliderField } from "../fields";
import { Section } from "../section";

export function AdjustPanel() {
  const adjust = useSettingsStore((s) => s.settings.adjust);
  const setAdjust = useSettingsStore((s) => s.setAdjust);

  return (
    <Section
      id="adjust"
      title="Adjust"
      icon="adjust"
      actions={
        <IconButton
          icon="reset"
          label="Reset adjustments"
          size="icon-xs"
          onClick={() => setAdjust({ brightness: 0, contrast: 0, gamma: 1, saturation: 0, hue: 0, invert: false })}
        />
      }
    >
      <SliderField
        label="Brightness"
        value={adjust.brightness}
        onChange={(brightness) => setAdjust({ brightness })}
        min={-100}
        max={100}
        defaultValue={0}
      />
      <SliderField
        label="Contrast"
        value={adjust.contrast}
        onChange={(contrast) => setAdjust({ contrast })}
        min={-100}
        max={100}
        defaultValue={0}
      />
      <SliderField
        label="Gamma"
        value={adjust.gamma}
        onChange={(gamma) => setAdjust({ gamma })}
        min={0.1}
        max={3}
        step={0.01}
        defaultValue={1}
      />
      <SliderField
        label="Saturation"
        value={adjust.saturation}
        onChange={(saturation) => setAdjust({ saturation })}
        min={-100}
        max={100}
        defaultValue={0}
      />
      <SliderField
        label="Hue"
        value={adjust.hue}
        onChange={(hue) => setAdjust({ hue })}
        min={-180}
        max={180}
        defaultValue={0}
        unit="°"
      />
      <FieldRow label="Invert">
        <Switch
          aria-label="Invert"
          checked={adjust.invert}
          onCheckedChange={(invert) => setAdjust({ invert })}
        />
      </FieldRow>
    </Section>
  );
}
