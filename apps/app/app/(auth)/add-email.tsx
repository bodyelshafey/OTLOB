import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/lib/endpoints/auth";
import { useAuthStore } from "@/store/authStore";
import { colors, fonts, radii, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

// The optional "Add your email" onboarding step (2026-09-13 phone-first
// pivot) — shown right after phone verification succeeds, but fully
// skippable. No OTP here; see AuthService.addEmail on the backend. Also
// reachable later from account settings for anyone who skipped it.
export default function AddEmail() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === "true";
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const goHome = () => router.replace("/(tabs)");

  const addEmail = useMutation({
    mutationFn: () => authApi.addEmail(email),
    onSuccess: () => {
      if (user) setUser({ ...user, email });
      goHome();
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.code === "EMAIL_ALREADY_EXISTS") {
        setError(t("auth.emailAlreadyExists"));
        setShowHint(true);
        return;
      }
      setShowHint(false);
      setError(body?.message ?? t("common.error"));
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.addEmailTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.addEmailSubtitle")}</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.saveEmail")}
            onPress={() => {
              setError(null);
              addEmail.mutate();
            }}
            loading={addEmail.isPending}
            disabled={!email}
            style={{ marginTop: 16 }}
          />

          {isOnboarding && (
            <Pressable onPress={goHome} style={{ marginTop: 20, alignSelf: "center" }}>
              <Text style={styles.skipText}>{t("auth.skipForNow")}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing(6), flexGrow: 1, justifyContent: "center" },
  title: { fontFamily: fonts.headingExtrabold, fontSize: 22, color: colors.ink, textAlign: "center" },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    textAlign: "left",
  },
  errorText: { fontFamily: fonts.body, color: colors.danger, textAlign: "center", marginTop: 12 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkMuted },
});
