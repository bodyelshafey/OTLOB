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
import { useAuthStore } from "@/store/authStore";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { t } from "@/i18n";

export default function Login() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace("/(tabs)");
    },
    onError: () => setError(t("common.error")),
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
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.login")}
            onPress={() => {
              setError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={!email || !password}
            style={{ marginTop: 8 }}
          />

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
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing(6), flexGrow: 1, justifyContent: "center" },
  title: {
    fontFamily: fonts.headingExtrabold,
    fontSize: 24,
    color: colors.ink,
    marginBottom: 24,
    textAlign: "center",
  },
  errorText: { fontFamily: fonts.body, color: colors.danger, marginBottom: 12, textAlign: "center" },
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20 },
  footerText: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 14 },
  link: { fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 14 },
});
