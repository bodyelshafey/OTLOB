import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/lib/endpoints/auth";
import { useAuthStore } from "@/store/authStore";
import { colors, fonts, radii, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

// PIVOTED 2026-09-13: this is now the ONLY registration verification step
// (previously "step 2 of 2" after email — email is no longer part of
// registration at all). Identified by `phone` directly (public, pre-auth —
// the account has no tokens yet). Issues tokens directly on success, then
// routes to the optional "Add your email" onboarding screen (Skip-able)
// rather than straight to the tabs — see (auth)/add-email.tsx.
export default function RegisterVerifyPhone() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verifyRegistrationPhone(phone, code),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace({ pathname: "/(auth)/add-email", params: { onboarding: "true" } });
    },
    onError: () => {
      setError(t("auth.invalidCode"));
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendRegistrationPhoneCode(phone),
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN);
      setError(null);
    },
  });

  const handleChange = (value: string, index: number) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
      const next = Array(CODE_LENGTH).fill("");
      pasted.forEach((d, i) => (next[i] = d));
      setDigits(next);
      const lastIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
      inputs.current[lastIndex]?.focus();
      if (pasted.length === CODE_LENGTH) verify.mutate(next.join(""));
      return;
    }
    const next = [...digits];
    next[index] = value.replace(/\D/g, "");
    setDigits(next);
    setError(null);
    if (value && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === CODE_LENGTH) {
      verify.mutate(next.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.verifyPhoneTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.verifySubtitle")}</Text>
          <Text style={styles.phone}>{phone}</Text>

          <View style={styles.boxRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={digit}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                style={[styles.box, !!error && styles.boxError]}
                textAlign="center"
              />
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.verifyButton")}
            onPress={() => verify.mutate(digits.join(""))}
            loading={verify.isPending}
            disabled={digits.some((d) => !d)}
            style={{ marginTop: 20 }}
          />

          <Pressable
            onPress={() => resend.mutate()}
            disabled={cooldown > 0 || resend.isPending}
            style={styles.resendRow}
          >
            <Text style={[styles.resendText, cooldown > 0 && { color: colors.inkMuted }]}>
              {cooldown > 0 ? `${t("auth.resendIn")} ${cooldown}s` : t("auth.resendCode")}
            </Text>
          </Pressable>
          {resend.isSuccess && cooldown === RESEND_COOLDOWN && (
            <Text style={styles.sentText}>{t("auth.codeSent")}</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing(6), flexGrow: 1, justifyContent: "center" },
  title: {
    fontFamily: fonts.headingExtrabold,
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 8,
  },
  phone: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.primary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 24,
  },
  boxRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  boxError: { borderColor: colors.danger },
  errorText: {
    fontFamily: fonts.body,
    color: colors.danger,
    textAlign: "center",
    marginTop: 12,
  },
  resendRow: { alignSelf: "center", marginTop: 20, padding: 8 },
  resendText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
  sentText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.success,
    textAlign: "center",
    marginTop: 6,
  },
});
