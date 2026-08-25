import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, spacing, radii } from "@/theme";
import { getFavorites } from "@/lib/endpoints/engagement";
import { StoreCard } from "@/components/StoreCard";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingScreen } from "@/components/Feedback";
import { useCartStore } from "@/store/cartStore";
import { t } from "@/i18n";

export default function FavoritesScreen() {
  const [tab, setTab] = useState<"stores" | "products">("stores");
  const favorites = useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
  const addItem = useCartStore((s) => s.addItem);

  const stores = (favorites.data ?? []).filter((f) => f.store).map((f) => f.store!);
  const products = (favorites.data ?? []).filter((f) => f.product).map((f) => f.product!);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>{t("favorites.title")}</Text>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("stores")} style={[styles.tab, tab === "stores" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "stores" && styles.tabTextActive]}>{t("favorites.stores")}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("products")} style={[styles.tab, tab === "products" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "products" && styles.tabTextActive]}>{t("favorites.products")}</Text>
        </Pressable>
      </View>

      {favorites.isLoading ? (
        <LoadingScreen />
      ) : tab === "stores" ? (
        stores.length === 0 ? (
          <EmptyState icon="heart-outline" message={t("favorites.empty")} />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: spacing(5) }}
            contentContainerStyle={{ gap: 12, paddingBottom: spacing(6) }}
            renderItem={({ item }) => (
              <View style={{ flex: 1 }}>
                <StoreCard store={item} fullWidth />
              </View>
            )}
          />
        )
      ) : products.length === 0 ? (
        <EmptyState icon="heart-outline" message={t("favorites.empty")} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing(5) }}
          renderItem={({ item }) => <ProductCard product={item} onAdd={() => addItem(item)} />}
        />
      )}
    </SafeAreaView>
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
  },
  tabs: { flexDirection: "row", gap: 8, padding: spacing(5) },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  tabTextActive: { color: colors.white },
});
