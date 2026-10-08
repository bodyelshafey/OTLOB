import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, radii, shadow } from "@/theme";
import { t } from "@/i18n";
import type { Store } from "@/lib/types";

export function StoreCard({
  store,
  fullWidth = false,
}: {
  store: Store;
  fullWidth?: boolean;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/store/${store.id}`)}
      style={[styles.card, fullWidth && { width: "100%", marginEnd: 0 }, shadow.card]}
    >
      <Image
        source={{ uri: store.coverImage ?? undefined }}
        style={styles.image}
      />
      {!store.isOpen && (
        <View style={styles.closedBadge}>
          <Text style={styles.closedText}>{t("store.closed")}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {store.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={13} color={colors.accent} />
            <Text style={styles.metaText}>{Number(store.rating).toFixed(1)}</Text>
          </View>
          {!!store.deliveryTime && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.inkMuted} />
              <Text style={styles.metaText}>{store.deliveryTime}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginEnd: 12,
  },
  image: { width: "100%", height: 96, backgroundColor: colors.primary100 },
  closedBadge: {
    position: "absolute",
    top: 8,
    start: 8,
    backgroundColor: "rgba(11,37,48,0.75)",
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  closedText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 11 },
  body: { padding: 10 },
  name: { fontFamily: fonts.headingSemibold, fontSize: 14, color: colors.ink },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
});
