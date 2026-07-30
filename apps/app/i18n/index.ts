import { I18n } from "i18n-js";
import * as Localization from "expo-localization";
import ar from "./ar.json";
import en from "./en.json";

export const i18n = new I18n({ ar, en });

// Default: Arabic-first, per the brand spec. Falls back to device locale
// only the very first time (before the user has an explicit preference
// stored in useSettingsStore).
i18n.locale = "ar";
i18n.enableFallback = true;
i18n.defaultLocale = "ar";

export type AppLocale = "ar" | "en";

export function isRTL(locale: AppLocale) {
  return locale === "ar";
}

export function getDeviceLocaleGuess(): AppLocale {
  const tag = Localization.getLocales()[0]?.languageCode;
  return tag === "en" ? "en" : "ar";
}

export function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options);
}
