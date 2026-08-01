import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme";
import { useCartStore } from "@/store/cartStore";
import { LocaleToggle } from "./LocaleToggle";
import { t } from "@/i18n";

// Mirrors web/src/components/Header.tsx. The bottom tab bar already covers
// the nav-items role (Home/Stores/Orders/Profile) that the web's desktop
// <nav> handles, so this only reproduces what tabs DON'T cover: brand,
// location chip, locale toggle, and the cart icon + badge.
export function Header() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.row}>
        <Pressable onPress={() => router.push("/(tabs)")} hitSlop={8}>
          <Text style={styles.brand}>{t("common.appName")}</Text>
        </Pressable>

        <View style={styles.actions}>
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={14} color={colors.primary700} />
            <Text style={styles.locationText}>{t("common.location")}</Text>
          </View>

          <LocaleToggle />

          <Pressable onPress={() => router.push("/cart")} style={styles.cartButton} hitSlop={8}>
            <Ionicons name="bag-outline" size={18} color={colors.primary700} />
            {itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  brand: {
    fontFamily: fonts.headingExtrabold,
    fontSize: 22,
    color: colors.white,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary700 },
  cartButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    end: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fonts.mono, fontSize: 9, color: colors.white },
});
