"use client";

import { useRef, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Checkbox } from "@/components/shared/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
import { Label } from "@/components/shared/label";
import { downloadBlob } from "@/lib/image-io";
import { cn } from "@/lib/tailwind-utils";
import {
  backupFileName,
  createBackup,
  parseBackup,
  storageUsage,
  type BackupParts,
  type ParsedBackup,
} from "@/stores/backup";
import { usePaletteStore } from "@/stores/palette-store";
import { usePresetStore, type ImportMode } from "@/stores/preset-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Segmented } from "./fields";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xs tracking-[0.2em] text-zinc-500 uppercase">{children}</h3>;
}

function CheckRow({
  id,
  checked,
  onChange,
  disabled,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className={cn("text-zinc-300", disabled && "opacity-40")}>
        {children}
      </Label>
    </div>
  );
}

function ExportSection() {
  const presets = usePresetStore((s) => s.presets);
  const palettes = usePaletteStore((s) => s.palettes);
  const [parts, setParts] = useState<BackupParts>({ settings: true, presets: true, palettes: true });
  const [status, setStatus] = useState<string | null>(null);
  const nothing = !parts.settings && !parts.presets && !parts.palettes;

  const build = () => {
    const { settings, exportSettings } = useSettingsStore.getState();
    return JSON.stringify(createBackup({ settings, exportSettings, presets, palettes }, parts), null, 2);
  };

  return (
    <section className="grid gap-3">
      <Heading>Export</Heading>
      <div className="grid gap-2">
        <CheckRow id="exp-settings" checked={parts.settings} onChange={(settings) => setParts({ ...parts, settings })}>
          Current settings
        </CheckRow>
        <CheckRow id="exp-presets" checked={parts.presets} onChange={(p) => setParts({ ...parts, presets: p })}>
          Saved presets <span className="text-zinc-600">({presets.length})</span>
        </CheckRow>
        <CheckRow id="exp-palettes" checked={parts.palettes} onChange={(p) => setParts({ ...parts, palettes: p })}>
          Saved palettes <span className="text-zinc-600">({palettes.length})</span>
        </CheckRow>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={nothing}
          onClick={() => {
            downloadBlob(new Blob([build()], { type: "application/json" }), backupFileName());
            setStatus("Downloaded.");
          }}
        >
          <PixelIcon name="download" scale={1} />
          Download .json
        </Button>
        <Button
          variant="outline"
          disabled={nothing}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(build());
              setStatus("Copied to clipboard.");
            } catch {
              setStatus("Couldn't access the clipboard — use download instead.");
            }
          }}
        >
          Copy
        </Button>
      </div>
      {status && <p className="text-2xs text-zinc-500">{status}</p>}
    </section>
  );
}

function ImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [take, setTake] = useState<BackupParts>({ settings: true, presets: true, palettes: true });
  const [done, setDone] = useState<string | null>(null);

  const result = text.trim() ? parseBackup(text) : null;
  const backup: ParsedBackup | null = result?.ok ? result.backup : null;
  const found = {
    settings: !!backup?.settings,
    presets: backup?.presets?.length ?? 0,
    palettes: backup?.palettes?.length ?? 0,
  };
  const selected = (take.settings && found.settings) || (take.presets && found.presets > 0) || (take.palettes && found.palettes > 0);

  const load = (value: string) => {
    setText(value);
    setDone(null);
  };

  const apply = () => {
    if (!backup) return;
    const summary: string[] = [];
    if (take.settings && backup.settings) {
      useSettingsStore.getState().applySettings(backup.settings);
      if (backup.exportSettings) useSettingsStore.getState().setExport(backup.exportSettings);
      summary.push("settings");
    }
    if (take.presets && backup.presets?.length) {
      const n = usePresetStore.getState().importPresets(backup.presets, mode);
      summary.push(plural(n, "preset"));
    }
    if (take.palettes && backup.palettes?.length) {
      const n = usePaletteStore.getState().importPalettes(backup.palettes, mode);
      summary.push(plural(n, "palette"));
    }
    setText("");
    setDone(`Imported ${summary.join(", ")}.`);
  };

  return (
    <section className="grid gap-3">
      <Heading>Import</Heading>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <PixelIcon name="upload" scale={1} />
          Choose file…
        </Button>
        <span className="self-center text-2xs text-zinc-600">or paste below</span>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) load(await file.text());
            e.target.value = "";
          }}
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => load(e.target.value)}
        placeholder="Backup JSON, or a single settings object"
        aria-label="Backup JSON"
        spellCheck={false}
        rows={4}
        className="w-full resize-y rounded-none border border-input bg-zinc-950 px-2 py-1.5 font-mono text-2xs text-zinc-300 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
      />

      {result && !result.ok && <p className="text-2xs text-red-400">{result.error}</p>}

      {backup && (
        <div className="grid gap-3 border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="grid gap-2">
            <CheckRow
              id="imp-settings"
              checked={take.settings && found.settings}
              disabled={!found.settings}
              onChange={(settings) => setTake({ ...take, settings })}
            >
              Settings {found.settings ? <span className="text-zinc-600">(replaces current)</span> : <span className="text-zinc-600">— none</span>}
            </CheckRow>
            <CheckRow
              id="imp-presets"
              checked={take.presets && found.presets > 0}
              disabled={!found.presets}
              onChange={(presets) => setTake({ ...take, presets })}
            >
              {plural(found.presets, "preset")}
            </CheckRow>
            <CheckRow
              id="imp-palettes"
              checked={take.palettes && found.palettes > 0}
              disabled={!found.palettes}
              onChange={(palettes) => setTake({ ...take, palettes })}
            >
              {plural(found.palettes, "palette")}
            </CheckRow>
          </div>
          {(found.presets > 0 || found.palettes > 0) && (
            <div className="grid gap-1.5">
              <Segmented
                aria-label="Import mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "merge", label: "Merge", title: "Add to your saved presets and palettes" },
                  { value: "replace", label: "Replace", title: "Replace your saved presets and palettes" },
                ]}
              />
              <p className="text-2xs text-zinc-600">
                {mode === "merge"
                  ? "Adds to what you have. Duplicates are skipped."
                  : "Your current saved presets/palettes of the checked kinds are removed."}
              </p>
            </div>
          )}
          <Button onClick={apply} disabled={!selected}>
            Import
          </Button>
        </div>
      )}
      {done && <p className="text-2xs text-zinc-400">{done}</p>}
    </section>
  );
}

function StorageSection() {
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const openWelcome = useUiStore((s) => s.openWelcome);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  // Re-read on every render; the dialog re-renders whenever stores change.
  const { keys, bytes } = storageUsage();
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="grid gap-3">
      <Heading>Storage</Heading>
      <p className="text-zinc-400">
        Using <span className="text-zinc-200">{(bytes / 1024).toFixed(1)} KB</span> of this browser&apos;s
        localStorage across {plural(keys.length, "key")}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          title="Back to the default look; saved presets and palettes are kept"
          onClick={() => {
            resetSettings();
            setSettingsOpen(false);
          }}
        >
          <PixelIcon name="reset" scale={1} />
          Reset current settings
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSettingsOpen(false);
            openWelcome();
          }}
        >
          <PixelIcon name="info" scale={1} />
          Show welcome screen
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onMouseLeave={() => setConfirming(false)}
          onBlur={() => setConfirming(false)}
          onClick={() => {
            if (!confirming) return setConfirming(true);
            for (const key of keys) localStorage.removeItem(key);
            window.location.reload();
          }}
        >
          <PixelIcon name="trash" scale={1} />
          {confirming ? "Click again — this can't be undone" : "Reset everything"}
        </Button>
      </div>
      <p className="text-2xs text-zinc-600">
        Reset current settings only restores the default look. Reset everything also deletes your saved
        presets and palettes — export a backup first.
      </p>
    </section>
  );
}

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
          <div className="grid gap-1">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Back up, move or reset your dithix data.</DialogDescription>
          </div>
          <DialogClose
            aria-label="Close"
            className="grid size-7 place-items-center text-zinc-500 outline-none hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring"
          >
            <PixelIcon name="close" scale={1} />
          </DialogClose>
        </div>
        <div className="grid gap-6 p-5">
          <ExportSection />
          <ImportSection />
          <StorageSection />
        </div>
      </DialogContent>
    </Dialog>
  );
}
