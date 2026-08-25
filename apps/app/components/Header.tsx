import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, radii } from "@/theme";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { getNotifications } from "@/lib/endpoints/engagement";
import { LocaleToggle } from "./LocaleToggle";
import { t } from "@/i18n";
import * as Location from "expo-location";
import { Alert } from "react-native";


// Mirrors web/src/components/Header.tsx. The bottom tab bar already covers
// the nav-items role (Home/Stores/Orders/Profile) that the web's desktop
// <nav> handles, so this only reproduces what tabs DON'T cover: brand,
// location chip, locale toggle, and the cart icon + badge.
export function Header() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const [locationName, setLocationName] = useState("Location");
  const accessToken = useAuthStore((s) => s.accessToken);

  // Shares the exact query key the notifications screen and the realtime
  // socket hook already use — this bell's badge updates live off the same
  // cache invalidation (a new notification arriving over the socket)
  // without a second polling loop.
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    enabled: !!accessToken,
    staleTime: 15_000,
  });
  const unreadCount = notifications.data?.unreadCount ?? 0;

  const updateLocationName = async (latitude: number, longitude: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (result.length > 0) {
        const place = result[0];

        setLocationName(
          place.city ||
            place.district ||
            place.region ||
            "Current Location"
        );
      } else {
        setLocationName("Current Location");
      }
    } catch (error) {
      console.error("Error reverse geocoding location:", error);
      setLocationName("Current Location");
    }
  };

  const handleLocationPress = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Please allow location access to detect your location."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      console.log("Latitude:", latitude);
      console.log("Longitude:", longitude);

      await updateLocationName(latitude, longitude);
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Could not get your current location.");
    }
  };

  return ( 
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.row}>
        <Pressable onPress={() => router.push("/(tabs)")} hitSlop={8}>
          <Text style={styles.brand}>{t("common.appName")}</Text>
        </Pressable>

<Pressable
  onPress={handleLocationPress}
  style={styles.locationChip}
  hitSlop={8}
>
  <Ionicons
    name="location-outline"
    size={14}
    color={colors.primary700}
  />
  <Text style={styles.locationText}>
  {locationName}
</Text>
</Pressable>

        <View style={styles.actions}>
          

          <LocaleToggle />

          <Pressable onPress={() => router.push("/notifications")} style={styles.cartButton} hitSlop={8}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary700} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>

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
  container: {
    overflow: "hidden",
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg},
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 32,
    color: colors.white,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  locationText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary700, maxWidth: 100 },
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
