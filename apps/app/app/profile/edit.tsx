import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radii } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import * as authApi from "@/lib/endpoints/auth";
import { uploadImage } from "@/lib/endpoints/engagement";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

export default function EditProfile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [avatar, setAvatarUrl] = useState(user?.avatar ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);

  const updateMutation = useMutation({
    // `phone` is deliberately not sent here — it's read-only on this
    // screen. Changing it goes through /(auth)/add-phone below, which
    // checks uniqueness and requires a fresh OTP before the new number is
    // trusted; a plain profile PATCH has no way to (re-)verify it. Email
    // has no such requirement (§8.4 — optional, no OTP), so it's just
    // saved alongside name/avatar in the same action when it changed.
    mutationFn: async () => {
      const updated = await authApi.updateMe({ fullName, avatar });
      if (email && email !== user?.email) {
        await authApi.addEmail(email);
      }
      return { ...updated, email: email || updated.email };
    },
    onSuccess: (updated) => {
      setUser(updated);
      router.back();
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.code === "EMAIL_ALREADY_EXISTS") {
        setEmailError(t("auth.emailAlreadyExists"));
        return;
      }
      Alert.alert(t("common.error"));
    },
  });

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const { url } = await uploadImage(
      { uri: asset.uri, name: "avatar.jpg", type: "image/jpeg" },
      "avatars"
    );
    setAvatarUrl(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.editProfile") }} />
      <ScrollView contentContainerStyle={{ padding: spacing(5) }}>
        <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
          <Image source={{ uri: avatar || undefined }} style={styles.avatar} />
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </Pressable>

        <FormField label={t("auth.fullName")} value={fullName} onChangeText={setFullName} />
        <FormField
          label={t("auth.email")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t("auth.addEmailTitle")}
          error={emailError ?? undefined}
        />

        <View style={styles.phoneRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.phoneLabel}>{t("auth.phone")}</Text>
            <Text style={styles.phoneValue}>{user?.phone || "—"}</Text>
          </View>
          <Pressable onPress={() => router.push("/(auth)/add-phone")}>
            <Text style={styles.changeLink}>
              {user?.phone ? t("common.change") : t("auth.addPhoneTitle")}
            </Text>
          </Pressable>
        </View>

        <Button
          title={t("common.save")}
          onPress={() => updateMutation.mutate()}
          loading={updateMutation.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: -40 },
  avatarWrap: { alignSelf: "center", marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary100 },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    end: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
    marginBottom: 14,
  },
  phoneLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginBottom: 4 },
  phoneValue: { fontFamily: fonts.body, fontSize: 15, color: colors.inkMuted },
  changeLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
