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
}

/** Keeps valid hex strings only (stored data may contain anything), lowercased. */
const clean = (colors: unknown[]) =>
  colors.filter(isHex).map((c) => c.toLowerCase());

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
    })),
    {
      name: "dithix:palettes",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ palettes: s.palettes }),
      // Drop anything malformed rather than letting it break the palette panel.
      merge: (persisted, current) => {
        const raw = (persisted as Partial<PaletteState> | undefined)?.palettes;
        const palettes = Array.isArray(raw)
          ? raw
              .filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.colors))
              .map((p) => ({ ...p, colors: clean(p.colors) }))
              .filter((p) => p.colors.length > 0)
          : [];
        return { ...current, palettes };
      },
    },
  ),
);
