import React from "react";
import { View, Text, StyleSheet, FlatList, Image, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { useCartStore } from "@/store/cartStore";
import { useStore } from "@/hooks/useCatalog";
import { PriceText } from "@/components/PriceText";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/Feedback";
import { t } from "@/i18n";

export default function CartScreen() {
  const router = useRouter();
  const { storeId, lines, updateQuantity, subtotal } = useCartStore();
  const store = useStore(storeId ?? undefined);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("cart.title") }} />

      {lines.length === 0 ? (
        <EmptyState icon="cart-outline" message={t("cart.empty")} />
      ) : (
        <>
          {!!store.data?.name && <Text style={styles.storeName}>{store.data.name}</Text>}
          <FlatList
            data={lines}
            keyExtractor={(l) => l.product.id}
            contentContainerStyle={{ padding: spacing(5), gap: 12 }}
            renderItem={({ item }) => (
              <View style={styles.line}>
                <Image source={{ uri: item.product.image ?? undefined }} style={styles.image} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <PriceText value={item.product.price * item.quantity} size={14} />
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => updateQuantity(item.product.id, item.quantity - 1)} style={styles.stepBtn}>
                    <Ionicons name="remove" size={16} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable onPress={() => updateQuantity(item.product.id, item.quantity + 1)} style={styles.stepBtn}>
                    <Ionicons name="add" size={16} color={colors.ink} />
                  </Pressable>
                </View>
              </View>
            )}
          />

          <View style={styles.footer}>
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>{t("cart.subtotal")}</Text>
              <PriceText value={subtotal()} size={18} />
            </View>
            <Button title={t("cart.checkout")} onPress={() => router.push("/checkout")} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  storeName: {
    fontFamily: fonts.headingSemibold,
    fontSize: 15,
    color: colors.ink,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 10,
  },
  image: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.primary100 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink, marginBottom: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, minWidth: 18, textAlign: "center" },
  footer: {
    padding: spacing(5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  subtotalLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
});
