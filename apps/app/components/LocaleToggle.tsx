import React from "react";
import { Pressable, Text, StyleSheet, Alert } from "react-native";
import { useSettingsStore } from "@/store/settingsStore";
import { colors, fonts, radii } from "@/theme";
import type { AppLocale } from "@/i18n";

// Compact header toggle — mirrors web's LocaleToggle. Uses the same
// useSettingsStore already wired into RootLayout for the RTL flip.
export function LocaleToggle() {
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  const toggle = () => {
    const next: AppLocale = locale === "ar" ? "en" : "ar";
    setLocale(next);
    // Matches app/profile/language.tsx — RTL layout only takes effect on
    // the next cold start, so we surface the same notice here.
    Alert.alert(
      next === "ar" ? "تم التغيير" : "Changed",
      next === "ar"
        ? "أعد تشغيل التطبيق لتطبيق اتجاه الصفحة الجديد."
        : "Restart the app for the new layout direction to apply."
    );
  };

  return (
    <Pressable onPress={toggle} style={styles.button} hitSlop={8}>
      <Text style={styles.text}>{locale === "ar" ? "EN" : "ع"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
});
