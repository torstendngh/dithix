import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { isHex } from "@/lib/dither/color";

export const MAX_RECENT_COLORS = 16;

interface UiState {
  /** Whether the welcome dialog has been dismissed on this device. */
  onboarded: boolean;
  /** Welcome dialog visibility; opens automatically until onboarded. */
  welcomeOpen: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
  /** Settings dialog (backup, import, storage); not persisted. */
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  /** Colours picked in the colour picker, newest first. */
  recentColors: string[];
  addRecentColor: (hex: string) => void;
  /** Whether the logo banner shows at the top of the sidebar. */
  showLogo: boolean;
  setShowLogo: (show: boolean) => void;
  /** Sidebar sections currently expanded; all start closed. Not persisted. */
  openSections: string[];
  setSectionOpen: (id: string, open: boolean) => void;
  /** Allow several sidebar sections open at once; otherwise opening one closes the rest. */
  multiSections: boolean;
  setMultiSections: (multi: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    immer((set) => ({
      onboarded: false,
      welcomeOpen: true,
      openWelcome: () =>
        set((s) => {
          s.welcomeOpen = true;
        }),
      closeWelcome: () =>
        set((s) => {
          s.welcomeOpen = false;
          s.onboarded = true;
        }),
      settingsOpen: false,
      setSettingsOpen: (open) =>
        set((s) => {
          s.settingsOpen = open;
        }),
      recentColors: [],
      addRecentColor: (hex) =>
        set((s) => {
          const c = hex.toLowerCase();
          s.recentColors = [c, ...s.recentColors.filter((x) => x !== c)].slice(0, MAX_RECENT_COLORS);
        }),
      showLogo: true,
      setShowLogo: (show) =>
        set((s) => {
          s.showLogo = show;
        }),
      openSections: [],
      setSectionOpen: (id, open) =>
        set((s) => {
          const rest = s.openSections.filter((x) => x !== id);
          s.openSections = !open ? rest : s.multiSections ? [...rest, id] : [id];
        }),
      multiSections: false,
      setMultiSections: (multi) =>
        set((s) => {
          s.multiSections = multi;
          // Back to one-at-a-time: keep only the most recently opened.
          if (!multi) s.openSections = s.openSections.slice(-1);
        }),
    })),
    {
      name: "dithix:ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        recentColors: s.recentColors,
        showLogo: s.showLogo,
        multiSections: s.multiSections,
      }),
      // Returning visitors start with the dialog closed.
      merge: (persisted, current) => {
        const p = persisted as Partial<UiState> | undefined;
        const onboarded = p?.onboarded === true;
        const recentColors = Array.isArray(p?.recentColors)
          ? p.recentColors.filter(isHex).map((c) => c.toLowerCase()).slice(0, MAX_RECENT_COLORS)
          : [];
        const showLogo = p?.showLogo !== false;
        const multiSections = p?.multiSections === true;
        return { ...current, onboarded, welcomeOpen: !onboarded, recentColors, showLogo, multiSections };
      },
    },
  ),
);
