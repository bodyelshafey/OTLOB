import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import * as authApi from "@/lib/endpoints/auth";
import { t } from "@/i18n";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      logout();
      clearCart();
      router.replace("/(auth)/onboarding");
    },
  });

  const dashboardLink = getDashboardLink(user?.role);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView>
        <Text style={styles.title}>{t("profile.title")}</Text>

        <View style={styles.userCard}>
          <Image
            source={{ uri: user?.avatar ?? undefined }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.name}>{user?.fullName}</Text>
            <Text style={styles.email}>{user?.phone}</Text>
            {user?.email ? (
              <Text style={styles.email}>{user.email}</Text>
            ) : (
              <Pressable onPress={() => router.push("/(auth)/add-email")}>
                <Text style={styles.addEmailLink}>{t("profile.addEmail")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.menu}>
          <MenuItem icon="person-outline" label={t("profile.editProfile")} onPress={() => router.push("/profile/edit")} />
          <MenuItem icon="receipt-outline" label={t("profile.myOrders")} onPress={() => router.push("/(tabs)/orders")} />
          <MenuItem icon="location-outline" label={t("profile.myAddresses")} onPress={() => router.push("/addresses")} />
          <MenuItem icon="heart-outline" label={t("profile.myFavorites")} onPress={() => router.push("/(tabs)/favorites")} />
          <MenuItem icon="notifications-outline" label={t("profile.notifications")} onPress={() => router.push("/notifications")} />
          <MenuItem icon="language-outline" label={t("profile.language")} onPress={() => router.push("/profile/language")} />

          {dashboardLink && (
            <MenuItem
              icon="grid-outline"
              label={t(dashboardLink.labelKey)}
              onPress={() => router.push(dashboardLink.href as any)}
              highlight
            />
          )}
        </View>

        <Pressable
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert(t("auth.logout"), "", [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("auth.logout"), style: "destructive", onPress: () => logoutMutation.mutate() },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>{t("auth.logout")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function getDashboardLink(role?: string) {
  switch (role) {
    case "STORE_OWNER":
    case "EMPLOYEE":
      return { labelKey: "profile.storeDashboard", href: "/dashboard/store" };
    case "DRIVER":
      return { labelKey: "profile.driverDashboard", href: "/dashboard/driver" };
    case "ADMIN":
    case "SUPER_ADMIN":
      return { labelKey: "profile.adminDashboard", href: "/dashboard/admin" };
    default:
      return null;
  }
}

function MenuItem({
  icon,
  label,
  onPress,
  highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable style={[styles.menuItem, highlight && styles.menuItemHighlight]} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={20} color={highlight ? colors.primary : colors.ink} />
        <Text style={[styles.menuLabel, highlight && { color: colors.primary, fontFamily: fonts.bodyBold }]}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: -40 },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.ink,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(4),
    marginBottom: 12,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing(5),
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
    ...shadow.card,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary100 },
  name: { fontFamily: fonts.headingSemibold, fontSize: 16, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  addEmailLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary, marginTop: 2 },
  menu: { marginHorizontal: spacing(5), gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemHighlight: { backgroundColor: colors.primary50 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: spacing(5),
    marginVertical: 24,
    paddingVertical: 14,
  },
  logoutText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.danger },
});
