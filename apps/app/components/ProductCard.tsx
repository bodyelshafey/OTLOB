import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, shadow } from "@/theme";
import { PriceText } from "./PriceText";
import { t } from "@/i18n";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  return (
    <View style={[styles.card, shadow.card]}>
      <Image source={{ uri: product.image ?? undefined }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {!!product.description && (
          <Text style={styles.desc} numberOfLines={2}>
            {product.description}
          </Text>
        )}
        <View style={styles.footer}>
          <PriceText value={product.price} />
          <Pressable
            onPress={onAdd}
            disabled={!product.isAvailable}
            style={[styles.addBtn, !product.isAvailable && { opacity: 0.4 }]}
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        </View>
        {!product.isAvailable && (
          <Text style={styles.unavailable}>{t("store.unavailable")}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: { width: 90, height: 90, backgroundColor: colors.primary100 },
  body: { flex: 1, padding: 10, justifyContent: "center" },
  name: { fontFamily: fonts.headingSemibold, fontSize: 14, color: colors.ink },
  desc: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  addBtn: {
    backgroundColor: colors.primary,
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailable: { fontFamily: fonts.body, fontSize: 11, color: colors.danger, marginTop: 4 },
});
