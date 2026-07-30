import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

export default function Onboarding() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t("auth.welcome")}</Text>
        <Text style={styles.subtitle}>{t("auth.welcomeSubtitle")}</Text>
      </View>
      <View style={styles.actions}>
        <Button title={t("auth.login")} onPress={() => router.push("/(auth)/login")} />
        <Button
          title={t("auth.register")}
          variant="outline"
          onPress={() => router.push("/(auth)/register")}
          style={{ marginTop: 12 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary50, justifyContent: "space-between" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(6) },
  logo: { width: 96, height: 96, marginBottom: 24, borderRadius: 20 },
  title: { fontFamily: fonts.headingExtrabold, fontSize: 26, color: colors.ink, textAlign: "center" },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  actions: { padding: spacing(6) },
});
