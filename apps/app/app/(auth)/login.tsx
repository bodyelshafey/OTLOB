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
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuthStore } from "@/store/authStore";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { t } from "@/i18n";

export default function Login() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => authApi.login(identifier, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace("/(tabs)");
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      // Correct credentials but the phone hasn't been verified yet — see
      // AuthService.login (2026-09-13 pivot: email verification no longer
      // gates login at all, only phone does).
      if (body?.code === "PHONE_VERIFICATION_REQUIRED") {
        router.replace({
          pathname: "/(auth)/register-verify-phone",
          params: { phone: body.phone ?? "" },
        });
        return;
      }
      setError(getApiErrorMessage(err));
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth.login")}</Text>

          <FormField
            label={t("auth.phone")}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="phone-pad"
          />
          <FormField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotRow}
          >
            <Text style={styles.link}>{t("auth.forgotPassword")}</Text>
          </Pressable>
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.login")}
            onPress={() => {
              setError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={!identifier || !password}
            style={{ marginTop: 8 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("auth.or")}</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleSignInButton />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{t("auth.noAccount")}</Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.link}>{t("auth.register")}</Text>
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
  errorText: { fontFamily: fonts.body, color: colors.danger, marginBottom: 12, textAlign: "center" },
  forgotRow: { alignSelf: "flex-start", marginBottom: 12 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20 },
  footerText: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 14 },
  link: { fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 14 },
});
