import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface UiState {
  /** Whether the welcome dialog has been dismissed on this device. */
  onboarded: boolean;
  /** Welcome dialog visibility; opens automatically until onboarded. */
  welcomeOpen: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
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
    })),
    {
      name: "dithix:ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ onboarded: s.onboarded }),
      // Returning visitors start with the dialog closed.
      merge: (persisted, current) => {
        const onboarded = (persisted as Partial<UiState> | undefined)?.onboarded === true;
        return { ...current, onboarded, welcomeOpen: !onboarded };
      },
    },
  ),
);
