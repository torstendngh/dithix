"use client";

import { deepEqual } from "@/lib/deep-equal";
import { BUILTIN_PRESETS, usePresetStore, type PresetGroup } from "@/stores/preset-store";
import { useSettingsStore } from "@/stores/settings-store";
import { LibraryPicker } from "./library-picker";

const BUILTIN_GROUPS: { group: PresetGroup; label: string }[] = [
  { group: "official", label: "Official" },
  { group: "classic", label: "Classic" },
  { group: "games", label: "Games" },
  { group: "print", label: "Print" },
  { group: "wild", label: "Wild" },
  { group: "fx", label: "Glitch & FX" },
];

/** Preset manager: apply, save, overwrite, rename and delete. */
export function PresetPicker() {
  const settings = useSettingsStore((s) => s.settings);
  const applySettings = useSettingsStore((s) => s.applySettings);
  const saved = usePresetStore((s) => s.presets);
  const { savePreset, overwritePreset, renamePreset, deletePreset } = usePresetStore.getState();

  const all = [...saved, ...BUILTIN_PRESETS];
  const active = all.find((p) => deepEqual(p.settings, settings));

  return (
    <LibraryPicker
      noun="preset"
      icon="bookmark"
      triggerLabel="Preset"
      current="settings"
      saved={saved}
      builtIn={BUILTIN_GROUPS.map(({ group, label }) => ({
        label,
        items: BUILTIN_PRESETS.filter((p) => p.group === group),
      }))}
      activeId={active?.id ?? null}
      onApply={(id) => {
        const preset = all.find((p) => p.id === id);
        if (preset) applySettings(preset.settings);
      }}
      onSave={(name) => savePreset(name, useSettingsStore.getState().settings)}
      onOverwrite={(id) => overwritePreset(id, useSettingsStore.getState().settings)}
      onRename={renamePreset}
      onDelete={deletePreset}
    />
  );
}
