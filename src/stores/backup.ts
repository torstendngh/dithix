import { completeSettings, defaultExportSettings } from "@/lib/dither/defaults";
import type { DitherSettings, ExportSettings } from "@/lib/dither/types";
import { mergeDefaults } from "@/lib/merge-defaults";
import { normalizePalettes, type SavedPalette } from "./palette-store";
import { normalizePresets, type Preset } from "./preset-store";

export const BACKUP_VERSION = 1;

/** File format for exported settings. Every part is optional. */
export interface Backup {
  app: "dithix";
  version: number;
  exportedAt: string;
  settings?: DitherSettings;
  exportSettings?: ExportSettings;
  presets?: Preset[];
  palettes?: SavedPalette[];
}

export interface BackupParts {
  settings: boolean;
  presets: boolean;
  palettes: boolean;
}

export interface BackupSource {
  settings: DitherSettings;
  exportSettings: ExportSettings;
  presets: Preset[];
  palettes: SavedPalette[];
}

export function createBackup(source: BackupSource, parts: BackupParts, now = new Date()): Backup {
  const backup: Backup = { app: "dithix", version: BACKUP_VERSION, exportedAt: now.toISOString() };
  if (parts.settings) {
    backup.settings = structuredClone(source.settings);
    backup.exportSettings = structuredClone(source.exportSettings);
  }
  if (parts.presets) backup.presets = structuredClone(source.presets);
  if (parts.palettes) backup.palettes = structuredClone(source.palettes);
  return backup;
}

export function backupFileName(now = new Date()): string {
  return `dithix-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** What a parsed file actually contains, validated and ready to apply. */
export interface ParsedBackup {
  settings?: DitherSettings;
  exportSettings?: ExportSettings;
  presets?: Preset[];
  palettes?: SavedPalette[];
}

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Bare settings, e.g. a single preset's settings copied from the console. */
const looksLikeSettings = (v: Record<string, unknown>) =>
  ["resize", "adjust", "dither", "palette"].filter((k) => isObject(v[k])).length >= 2;

/**
 * Accepts a dithix backup file or a bare settings object. Everything is validated: malformed
 * presets or palettes are dropped and missing settings are filled in.
 */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't valid JSON." };
  }
  if (!isObject(data)) return { ok: false, error: "Expected a dithix backup or settings object." };

  if (data.app !== "dithix") {
    if (looksLikeSettings(data)) return { ok: true, backup: { settings: completeSettings(data) } };
    return { ok: false, error: "This doesn't look like a dithix backup." };
  }
  if (typeof data.version === "number" && data.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of dithix." };
  }

  const backup: ParsedBackup = {};
  if (isObject(data.settings)) backup.settings = completeSettings(data.settings);
  if (isObject(data.exportSettings)) backup.exportSettings = mergeDefaults(defaultExportSettings(), data.exportSettings);
  if (Array.isArray(data.presets)) backup.presets = normalizePresets(data.presets);
  if (Array.isArray(data.palettes)) backup.palettes = normalizePalettes(data.palettes);
  if (!backup.settings && !backup.presets?.length && !backup.palettes?.length) {
    return { ok: false, error: "The backup is empty." };
  }
  return { ok: true, backup };
}

/** Byte size of everything dithix keeps in localStorage. */
export function storageUsage(storage: Storage = localStorage): { keys: string[]; bytes: number } {
  const keys: string[] = [];
  let bytes = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith("dithix:")) continue;
    keys.push(key);
    // UTF-16 code units, which is how browsers count the quota.
    bytes += (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
  }
  return { keys: keys.sort(), bytes };
}
