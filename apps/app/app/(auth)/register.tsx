import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/lib/endpoints/auth";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { t } from "@/i18n";

// PIVOTED 2026-09-13: phone is the sole primary identity now — no email
// field here at all. Registration is a 2-step flow: create account
// (phone+password) → verify phone OTP (see register-verify-phone.tsx) →
// done. Email becomes a fully optional step AFTER that (see
// (auth)/add-email.tsx via the onboarding hop from verify), not part of
// registration itself.
export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLoginCta, setShowLoginCta] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.register({ fullName, phone, password }),
    onSuccess: (data) => {
      router.replace({ pathname: "/(auth)/register-verify-phone", params: { phone: data.phone } });
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.code === "PHONE_ALREADY_EXISTS") {
        setError(t("auth.phoneAlreadyExists"));
        setShowLoginCta(true);
        return;
      }
      setShowLoginCta(false);
      setError(typeof body?.message === "string" ? body.message : Array.isArray(body?.message) ? body.message.join("\n") : t("common.error"));
    },
  });

  const canSubmit = fullName && phone.length >= 8 && password.length >= 8;
  // Backend normalizes common Egyptian formats (01xxxxxxxxx, 1xxxxxxxxx,
  // 201xxxxxxxxx, +201xxxxxxxxx) to E.164 before validating — see
  // RegisterDto.normalizeEgyptianPhone. This just needs "something
  // plausible", the server does the real normalization + validation.

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth.register")}</Text>

          <FormField label={t("auth.fullName")} value={fullName} onChangeText={setFullName} />
          <FormField
            label={t("auth.phone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
          />
          <FormField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {!!error && (
            <View>
              <Text style={styles.errorText}>{error}</Text>
              {showLoginCta && (
                <Pressable onPress={() => router.push("/(auth)/login")}>
                  <Text style={[styles.link, { textAlign: "center", marginBottom: 12 }]}>
                    {t("auth.login")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <Button
            title={t("auth.register")}
            onPress={() => {
              setError(null);
              setShowLoginCta(false);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={!canSubmit}
            style={{ marginTop: 8 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("auth.or")}</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleSignInButton />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{t("auth.haveAccount")}</Text>
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.link}>{t("auth.login")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: -40 },
  content: { padding: spacing(6), flexGrow: 1, justifyContent: "center" },
  title: {
    fontFamily: fonts.headingExtrabold,
    fontSize: 24,
    color: colors.ink,
    marginBottom: 24,
    textAlign: "center",
  },
  errorText: { fontFamily: fonts.body, color: colors.danger, marginBottom: 4, textAlign: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20 },
  footerText: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 14 },
  link: { fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 14 },
});
