"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
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

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

type Tab = "backup" | "import" | "storage" | "about";

const TABS: { id: Tab; label: string; icon: IconName; title: string; description: string }[] = [
  {
    id: "about",
    label: "About",
    icon: "info",
    title: "About dithix",
    description: "Dithered pixel art from any image, entirely in your browser.",
  },
  {
    id: "backup",
    label: "Backup",
    icon: "download",
    title: "Back up",
    description: "Save your look, presets and palettes to a file you can keep or move to another browser.",
  },
  {
    id: "import",
    label: "Import",
    icon: "upload",
    title: "Import",
    description: "Bring in a backup file, or a settings object someone shared with you.",
  },
  {
    id: "storage",
    label: "Storage",
    icon: "save",
    title: "Storage",
    description: "Everything dithix keeps lives in this browser's localStorage. Nothing is uploaded.",
  },
];

// ── shared bits ──────────────────────────────────────────────────────────

/** Toggleable tile: what a backup holds or an import brings in. */
function PartTile({
  icon,
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  icon: IconName;
  label: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative grid content-start gap-2 border p-3 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
      )}
    >
      <span className="flex items-center justify-between">
        <PixelIcon name={icon} scale={1} className={checked ? "text-zinc-100" : "text-zinc-500"} />
        <span
          className={cn(
            "grid size-3.5 place-items-center border",
            checked ? "border-zinc-200 bg-zinc-200 text-zinc-950" : "border-zinc-700",
          )}
          aria-hidden
        >
          {checked && <PixelIcon name="check" scale={1} className="size-2.5" />}
        </span>
      </span>
      <span className="grid gap-0.5">
        <span className={checked ? "text-zinc-100" : "text-zinc-400"}>{label}</span>
        <span className="text-2xs text-zinc-500">{detail}</span>
      </span>
    </button>
  );
}

function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 border px-3 py-2 text-2xs leading-relaxed",
        tone === "success" && "border-emerald-900/70 bg-emerald-950/30 text-emerald-300",
        tone === "error" && "border-red-900/70 bg-red-950/30 text-red-300",
        tone === "info" && "border-zinc-800 bg-zinc-900/40 text-zinc-400",
      )}
    >
      <PixelIcon name={tone === "error" ? "close" : tone === "success" ? "check" : "info"} scale={1} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-2xs tracking-[0.2em] text-zinc-500 uppercase">{children}</h4>;
}

// ── tabs ─────────────────────────────────────────────────────────────────

function BackupTab() {
  const presets = usePresetStore((s) => s.presets);
  const palettes = usePaletteStore((s) => s.palettes);
  const settings = useSettingsStore((s) => s.settings);
  const exportSettings = useSettingsStore((s) => s.exportSettings);
  const [parts, setParts] = useState<BackupParts>({ settings: true, presets: true, palettes: true });
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const nothing = !parts.settings && !parts.presets && !parts.palettes;

  const json = JSON.stringify(createBackup({ settings, exportSettings, presets, palettes }, parts), null, 2);
  const set = (patch: Partial<BackupParts>) => {
    setParts({ ...parts, ...patch });
    setStatus(null);
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <SubHeading>Include</SubHeading>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PartTile
            icon="adjust"
            label="Current look"
            detail="Every panel's settings"
            checked={parts.settings}
            onChange={(v) => set({ settings: v })}
          />
          <PartTile
            icon="bookmark"
            label="Presets"
            detail={presets.length ? `${plural(presets.length, "saved preset")}` : "None saved yet"}
            checked={parts.presets}
            onChange={(v) => set({ presets: v })}
          />
          <PartTile
            icon="palette"
            label="Palettes"
            detail={palettes.length ? `${plural(palettes.length, "saved palette")}` : "None saved yet"}
            checked={parts.palettes}
            onChange={(v) => set({ palettes: v })}
          />
        </div>
      </div>

      <div className="grid gap-2 border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-zinc-300">{backupFileName()}</span>
          <span className="shrink-0 text-2xs text-zinc-500 tabular-nums">{nothing ? "—" : formatBytes(json.length)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={nothing}
            onClick={() => {
              downloadBlob(new Blob([json], { type: "application/json" }), backupFileName());
              setStatus({ tone: "success", text: "Backup downloaded." });
            }}
          >
            <PixelIcon name="download" scale={1} />
            Download
          </Button>
          <Button
            variant="outline"
            disabled={nothing}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(json);
                setStatus({ tone: "success", text: "Copied to the clipboard — paste it into Import anywhere." });
              } catch {
                setStatus({ tone: "error", text: "Couldn't access the clipboard. Use Download instead." });
              }
            }}
          >
            Copy JSON
          </Button>
        </div>
      </div>

      {nothing && <Notice>Pick at least one thing to include.</Notice>}
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
    </div>
  );
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  const load = (value: string, name: string | null = null) => {
    setText(value);
    setFileName(name);
    setDone(null);
  };
  const loadFile = async (file: File | undefined) => {
    if (file) load(await file.text(), file.name);
  };
  const clear = () => {
    setText("");
    setFileName(null);
  };

  const apply = () => {
    if (!backup) return;
    const summary: string[] = [];
    if (take.settings && backup.settings) {
      useSettingsStore.getState().applySettings(backup.settings);
      if (backup.exportSettings) useSettingsStore.getState().setExport(backup.exportSettings);
      summary.push("your look");
    }
    if (take.presets && backup.presets?.length) {
      const n = usePresetStore.getState().importPresets(backup.presets, mode);
      summary.push(plural(n, "preset"));
    }
    if (take.palettes && backup.palettes?.length) {
      const n = usePaletteStore.getState().importPalettes(backup.palettes, mode);
      summary.push(plural(n, "palette"));
    }
    clear();
    setPasting(false);
    setDone(`Imported ${summary.join(", ")}.`);
  };

  return (
    <div className="grid gap-5">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          await loadFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!backup && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void loadFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "grid place-items-center gap-2 border border-dashed px-4 py-8 text-center outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
              dragging ? "border-zinc-300 bg-zinc-900" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50",
            )}
          >
            <span className="grid size-9 place-items-center border border-zinc-700 bg-zinc-900 text-zinc-300">
              <PixelIcon name="upload" />
            </span>
            <span className="text-zinc-200">{dragging ? "Drop to read it" : "Drop a backup file here"}</span>
            <span className="text-2xs text-zinc-500">or click to choose a .json file</span>
          </button>

          <button
            type="button"
            onClick={() => setPasting((p) => !p)}
            aria-expanded={pasting}
            className="flex items-center gap-1.5 justify-self-start text-2xs text-zinc-500 outline-none hover:text-zinc-200 focus-visible:underline"
          >
            <PixelIcon name={pasting ? "chevron-down" : "chevron-right"} scale={1} />
            Paste JSON instead
          </button>
          {pasting && (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => load(e.target.value)}
              placeholder="Backup JSON, or a single settings object"
              aria-label="Backup JSON"
              spellCheck={false}
              rows={5}
              className="w-full resize-y rounded-none border border-input bg-zinc-950 px-2 py-1.5 font-mono text-2xs text-zinc-300 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          )}
          {result && !result.ok && <Notice tone="error">{result.error}</Notice>}
        </div>
      )}

      {backup && (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3 border border-zinc-800 bg-zinc-900/30 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-zinc-300">
              <PixelIcon name="check" scale={1} className="shrink-0 text-emerald-400" />
              <span className="truncate">{fileName ?? "Pasted backup"}</span>
            </span>
            <button type="button" onClick={clear} className="shrink-0 text-2xs text-zinc-500 outline-none hover:text-zinc-200 focus-visible:underline">
              Choose another
            </button>
          </div>

          <div className="grid gap-2">
            <SubHeading>Bring in</SubHeading>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <PartTile
                icon="adjust"
                label="Look"
                detail={found.settings ? "Replaces the current one" : "Not in this file"}
                checked={take.settings && found.settings}
                disabled={!found.settings}
                onChange={(settings) => setTake({ ...take, settings })}
              />
              <PartTile
                icon="bookmark"
                label="Presets"
                detail={found.presets ? plural(found.presets, "preset") : "Not in this file"}
                checked={take.presets && found.presets > 0}
                disabled={!found.presets}
                onChange={(presets) => setTake({ ...take, presets })}
              />
              <PartTile
                icon="palette"
                label="Palettes"
                detail={found.palettes ? plural(found.palettes, "palette") : "Not in this file"}
                checked={take.palettes && found.palettes > 0}
                disabled={!found.palettes}
                onChange={(palettes) => setTake({ ...take, palettes })}
              />
            </div>
          </div>

          {(found.presets > 0 || found.palettes > 0) && (
            <div className="grid gap-2">
              <SubHeading>Saved presets & palettes</SubHeading>
              <Segmented
                aria-label="Import mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "merge", label: "Add to mine", title: "Add to your saved presets and palettes" },
                  { value: "replace", label: "Replace mine", title: "Replace your saved presets and palettes" },
                ]}
              />
              <p className={cn("text-2xs leading-relaxed", mode === "replace" ? "text-amber-400/90" : "text-zinc-500")}>
                {mode === "merge"
                  ? "Adds them alongside yours. Exact duplicates are skipped."
                  : "Your saved presets/palettes of the checked kinds are removed first."}
              </p>
            </div>
          )}

          <Button onClick={apply} disabled={!selected}>
            <PixelIcon name="upload" scale={1} />
            Import
          </Button>
        </div>
      )}

      {done && <Notice tone="success">{done}</Notice>}
    </div>
  );
}

/** Friendly names and meter colours for the keys dithix stores. */
const STORAGE_KEYS: Record<string, { label: string; color: string }> = {
  "dithix:settings": { label: "Current look", color: "bg-emerald-400" },
  "dithix:presets": { label: "Saved presets", color: "bg-sky-400" },
  "dithix:palettes": { label: "Saved palettes", color: "bg-fuchsia-400" },
  "dithix:ui": { label: "Interface & recent colours", color: "bg-amber-400" },
};
// Browsers typically allow about 5 MB of localStorage per site.
const QUOTA = 5 * 1024 * 1024;

function ActionRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="grid gap-0.5">
        <span className="text-zinc-200">{title}</span>
        <span className="text-2xs leading-relaxed text-zinc-500">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function StorageTab() {
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  // Re-read on every render; the dialog re-renders whenever stores change.
  const { keys, bytes, items } = storageUsage();
  const [confirming, setConfirming] = useState(false);
  // The bar splits what's used; against the whole quota it would be an unreadable sliver.
  const share = (b: number) => (bytes ? (b / bytes) * 100 : 0);
  const ofQuota = (bytes / QUOTA) * 100;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg text-zinc-50 tabular-nums">{formatBytes(bytes)}</span>
          <span className="text-2xs text-zinc-500">
            {ofQuota < 0.1 ? "under 0.1%" : `${ofQuota.toFixed(1)}%`} of the ~5 MB browsers allow
          </span>
        </div>
        <div className="flex h-2.5 gap-px overflow-hidden border border-zinc-800 bg-zinc-900" aria-hidden>
          {items.map((item) => (
            <span
              key={item.key}
              className={cn("h-full", STORAGE_KEYS[item.key]?.color ?? "bg-zinc-400")}
              style={{ width: `${share(item.bytes)}%` }}
            />
          ))}
        </div>
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-2xs">
              <span className={cn("size-2 shrink-0", STORAGE_KEYS[item.key]?.color ?? "bg-zinc-400")} />
              <span className="text-zinc-300">{STORAGE_KEYS[item.key]?.label ?? item.key}</span>
              <code className="text-zinc-600">{item.key}</code>
              <span className="ml-auto text-zinc-500 tabular-nums">{formatBytes(item.bytes)}</span>
            </li>
          ))}
          {items.length === 0 && <li className="text-2xs text-zinc-500">Nothing stored yet.</li>}
        </ul>
      </div>

      <div className="grid divide-y divide-zinc-800 border-y border-zinc-800">
        <ActionRow title="Reset the current look" description="Back to the default settings. Saved presets and palettes are kept.">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSettings();
              setSettingsOpen(false);
            }}
          >
            <PixelIcon name="reset" scale={1} />
            Reset look
          </Button>
        </ActionRow>
      </div>

      <div className="grid gap-3 border border-red-950 bg-red-950/15 p-3">
        <div className="grid gap-0.5">
          <span className="text-red-300">Danger zone</span>
          <span className="text-2xs leading-relaxed text-zinc-500">
            Deletes everything above — your look, saved presets, palettes and recent colours — and reloads.
            Back up first if you want to keep anything.
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="justify-self-start"
          onMouseLeave={() => setConfirming(false)}
          onBlur={() => setConfirming(false)}
          onClick={() => {
            if (!confirming) return setConfirming(true);
            for (const key of keys) localStorage.removeItem(key);
            window.location.reload();
          }}
        >
          <PixelIcon name="trash" scale={1} />
          {confirming ? "Click again to delete everything" : "Reset everything"}
        </Button>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘ O", "Open an image"],
  ["⌘ S", "Download the result"],
  ["⌘ V", "Paste an image"],
  ["Space", "Hold to compare with the original"],
  ["0", "Fit to view"],
  ["1", "Actual size (100%)"],
  ["+  −", "Zoom in / out"],
];

function AboutTab() {
  const openWelcome = useUiStore((s) => s.openWelcome);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  return (
    <div className="grid gap-6">
      <div className="border-y border-zinc-800">
        <ActionRow title="Welcome screen" description="Show the intro you saw on your first visit.">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSettingsOpen(false);
              openWelcome();
            }}
          >
            <PixelIcon name="info" scale={1} />
            Show
          </Button>
        </ActionRow>
      </div>
      <div className="grid gap-2">
        <SubHeading>Keyboard</SubHeading>
        <dl className="grid divide-y divide-zinc-800/70 border-y border-zinc-800">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-zinc-300">{action}</dt>
              <dd className="flex gap-1">
                {keys.split(/\s+/).map((k) => (
                  <kbd key={k} className="min-w-6 border border-b-2 border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-center text-2xs text-zinc-200">
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <Notice>
        Images are processed on this device and never leave it. Your settings stay in this browser — use Backup to move
        them.
      </Notice>
    </div>
  );
}

// ── dialog ───────────────────────────────────────────────────────────────

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>("about");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[min(620px,calc(100dvh-2rem))] max-w-2xl flex-col sm:flex-row">
        {/* Rail: brand header + tabs. Becomes a top bar on narrow screens. */}
        <nav className="flex shrink-0 flex-col border-b border-zinc-800 bg-zinc-950 sm:w-48 sm:border-r sm:border-b-0" aria-label="Settings sections">
          <div className="relative hidden h-24 overflow-hidden border-b border-zinc-800 sm:block">
            <Image src="/bg.png" alt="" fill sizes="192px" className="object-cover brightness-[0.4] saturate-[0.9]" draggable={false} />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-zinc-950/90" />
            <div className="absolute inset-x-3 bottom-2.5 flex items-baseline justify-between">
              <span className="text-zinc-100">Settings</span>
              <span className="text-2xs text-zinc-500">v0.1</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto p-2 sm:grid sm:gap-0.5" role="tablist" aria-orientation="vertical">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 border-l-2 px-2.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
                  tab === t.id
                    ? "border-zinc-100 bg-zinc-900 text-zinc-50"
                    : "border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
                )}
              >
                <PixelIcon name={t.icon} scale={1} className={tab === t.id ? "text-zinc-100" : "text-zinc-600"} />
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col" role="tabpanel" aria-label={current.title}>
          <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 pt-5 pb-4">
            <div className="grid gap-1">
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription className="leading-relaxed">{current.description}</DialogDescription>
            </div>
            <DialogClose
              aria-label="Close"
              className="grid size-7 shrink-0 place-items-center text-zinc-500 outline-none hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring"
            >
              <PixelIcon name="close" scale={1} />
            </DialogClose>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === "backup" && <BackupTab />}
            {tab === "import" && <ImportTab />}
            {tab === "storage" && <StorageTab />}
            {tab === "about" && <AboutTab />}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
