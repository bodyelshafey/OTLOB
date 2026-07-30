import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
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
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatar, setAvatarUrl] = useState(user?.avatar ?? "");

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateMe({ fullName, phone, avatar }),
    onSuccess: (updated) => {
      setUser(updated);
      router.back();
    },
    onError: () => Alert.alert(t("common.error")),
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
        <FormField label={t("auth.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

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
  container: { flex: 1, backgroundColor: colors.bg },
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
});
