import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { isHex } from "@/lib/dither/color";
import { newId } from "@/lib/new-id";

export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
}

interface PaletteState {
  palettes: SavedPalette[];
  savePalette: (name: string, colors: string[]) => string;
  overwritePalette: (id: string, colors: string[]) => void;
  renamePalette: (id: string, name: string) => void;
  deletePalette: (id: string) => void;
  /** Adds (merge) or swaps in (replace) palettes; returns how many were added. */
  importPalettes: (palettes: SavedPalette[], mode: "merge" | "replace") => number;
}

/** Keeps valid hex strings only (stored data may contain anything), lowercased. */
const clean = (colors: unknown[]) =>
  colors.filter(isHex).map((c) => c.toLowerCase());

/** Validates palettes from storage or an imported file, dropping anything malformed. */
export function normalizePalettes(raw: unknown): SavedPalette[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.colors))
    .map((p) => ({
      id: p.id,
      name: p.name,
      colors: clean(p.colors),
      createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
    }))
    .filter((p) => p.colors.length > 0);
}

export const usePaletteStore = create<PaletteState>()(
  persist(
    immer((set) => ({
      palettes: [],
      savePalette: (name, colors) => {
        const id = newId();
        set((s) => {
          s.palettes.push({
            id,
            name: name.trim() || `Palette ${s.palettes.length + 1}`,
            colors: clean(colors),
            createdAt: Date.now(),
          });
        });
        return id;
      },
      overwritePalette: (id, colors) =>
        set((s) => {
          const palette = s.palettes.find((p) => p.id === id);
          if (palette) palette.colors = clean(colors);
        }),
      renamePalette: (id, name) =>
        set((s) => {
          const palette = s.palettes.find((p) => p.id === id);
          if (palette && name.trim()) palette.name = name.trim();
        }),
      deletePalette: (id) =>
        set((s) => {
          s.palettes = s.palettes.filter((p) => p.id !== id);
        }),
      importPalettes: (incoming, mode) => {
        let added = 0;
        set((s) => {
          if (mode === "replace") {
            s.palettes = structuredClone(incoming);
            added = incoming.length;
            return;
          }
          for (const palette of incoming) {
            const existing = s.palettes.find((p) => p.id === palette.id);
            if (existing && existing.name === palette.name && existing.colors.join() === palette.colors.join()) continue;
            // Same id but different content: keep both rather than overwrite.
            s.palettes.push({ ...structuredClone(palette), id: existing ? newId() : palette.id });
            added++;
          }
        });
        return added;
      },
    })),
    {
      name: "dithix:palettes",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ palettes: s.palettes }),
      // Drop anything malformed rather than letting it break the palette panel.
      merge: (persisted, current) => ({
        ...current,
        palettes: normalizePalettes((persisted as Partial<PaletteState> | undefined)?.palettes),
      }),
    },
  ),
);
