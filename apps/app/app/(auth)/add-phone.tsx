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
import { t } from "@/i18n";

export default function AddPhone() {
  const router = useRouter();
  const [phone, setPhone] = useState("+20");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => authApi.addPhone(phone),
    onSuccess: () => {
      router.replace({ pathname: "/(auth)/verify-phone", params: { phone } });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? t("common.error")),
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth.addPhoneTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.addPhoneSubtitle")}</Text>

          <FormField
            label={t("auth.phone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>{t("auth.phoneHint")}</Text>
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={t("auth.sendCode")}
            onPress={() => {
              setError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={phone.length < 8}
            style={{ marginTop: 8 }}
          />

          <Pressable onPress={() => router.replace("/(tabs)")} style={styles.skipRow}>
            <Text style={styles.skipText}>{t("auth.skipForNow")}</Text>
          </Pressable>
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
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: -8, marginBottom: 8 },
  errorText: { fontFamily: fonts.body, color: colors.danger, marginBottom: 12, textAlign: "center" },
  skipRow: { alignSelf: "center", marginTop: 20, padding: 8 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkMuted },
});
