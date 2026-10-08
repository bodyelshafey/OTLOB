import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppLocale } from "@/i18n";

interface SettingsState {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: "ar",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "otlob-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
