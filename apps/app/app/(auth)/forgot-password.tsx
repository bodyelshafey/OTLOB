import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/lib/endpoints/auth";
import { colors, fonts, spacing } from "@/theme";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { t } from "@/i18n";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.checkYourEmail")}</Text>
          <Text style={styles.subtitle}>{t("auth.resetCodeSentGeneric")}</Text>
          <Button
            title={t("auth.resetPasswordTitle")}
            onPress={() => router.replace({ pathname: "/(auth)/reset-password", params: { email } })}
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
          <Text style={styles.title}>{t("auth.forgotPassword")}</Text>
          <Text style={styles.subtitle}>{t("auth.forgotPasswordSubtitle")}</Text>

          <FormField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Button
            title={t("auth.sendResetCode")}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!email}
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
    fontSize: 24,
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
});
