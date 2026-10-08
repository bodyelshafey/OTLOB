import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, spacing, radii } from "@/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { t } from "@/i18n";
import type { AppLocale } from "@/i18n";

export default function LanguageScreen() {
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  const choose = (next: AppLocale) => {
    if (next === locale) return;
    setLocale(next);
    Alert.alert(
      next === "ar" ? "تم التغيير" : "Changed",
      next === "ar"
        ? "أعد تشغيل التطبيق لتطبيق اتجاه الصفحة الجديد."
        : "Restart the app for the new layout direction to apply."
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.language") }} />
      <View style={{ padding: spacing(5), gap: 10 }}>
        <Option label="العربية" active={locale === "ar"} onPress={() => choose("ar")} />
        <Option label="English" active={locale === "en"} onPress={() => choose("en")} />
      </View>
    </SafeAreaView>
  );
}

function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <Text style={[styles.optionText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: -40 },
  option: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
});
