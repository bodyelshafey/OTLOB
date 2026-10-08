import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/lib/endpoints/auth";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { t } from "@/i18n";

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(email, code, newPassword),
    onSuccess: () => setDone(true),
    onError: (err: any) => setError(err?.response?.data?.message ?? t("common.error")),
  });

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.resetSuccessTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.resetSuccessSubtitle")}</Text>
          <Button
            title={t("auth.login")}
            onPress={() => router.replace("/(auth)/login")}
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth.resetPasswordTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.resetPasswordSubtitle")}</Text>

          <FormField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            label={t("auth.code")}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
          />
          <FormField
            label={t("auth.newPassword")}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <FormField
            label={t("auth.confirmPassword")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.resetPasswordTitle")}
            onPress={() => {
              if (newPassword !== confirmPassword) {
                setError(t("auth.passwordsDontMatch"));
                return;
              }
              setError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={!email || code.length !== 6 || newPassword.length < 8}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
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
    marginBottom: 24,
  },
  errorText: { fontFamily: fonts.body, color: colors.danger, marginBottom: 12, textAlign: "center" },
});
