import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { useStore, useCategories, useProducts } from "@/hooks/useCatalog";
import { ProductCard } from "@/components/ProductCard";
import { LoadingScreen, EmptyState } from "@/components/Feedback";
import { useCartStore } from "@/store/cartStore";
import { t } from "@/i18n";
import type { Product } from "@/lib/types";

export default function StoreDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore(id);
  const categories = useCategories(id);
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const products = useProducts({ storeId: id, categoryId: activeCategory });
  const cart = useCartStore();

  if (store.isLoading || !store.data) return <LoadingScreen />;

  const handleAdd = (product: Product) => {
    // The cart store auto-switches stores on conflict — gate that behind a
    // confirmation here rather than silently wiping the previous cart.
    if (cart.storeId && cart.storeId !== product.storeId && cart.lines.length > 0) {
      Alert.alert(t("cart.clearConfirmTitle"), t("cart.clearConfirmBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), onPress: () => cart.addItem(product) },
      ]);
      return;
    }
    cart.addItem(product);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        <View>
          <Image source={{ uri: store.data.coverImage ?? undefined }} style={styles.cover} />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{store.data.name}</Text>
          {!!store.data.description && (
            <Text style={styles.description}>{store.data.description}</Text>
          )}
          <View style={styles.metaRow}>
            <MetaItem icon="star" text={Number(store.data.rating).toFixed(1)} />
            {!!store.data.deliveryTime && (
              <MetaItem icon="time-outline" text={store.data.deliveryTime} />
            )}
            <MetaItem
              icon="bicycle-outline"
              text={Number(store.data.deliveryFee) === 0 ? t("store.freeDelivery") : `${store.data.deliveryFee} ج.م`}
            />
          </View>
          <Text style={{ color: store.data.isOpen ? colors.success : colors.danger, fontFamily: fonts.bodyMedium, marginTop: 4 }}>
            {store.data.isOpen ? t("store.open") : t("store.closed")}
          </Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing(5), marginBottom: 12 }}
          ListHeaderComponent={
            <Pressable
              onPress={() => setActiveCategory(undefined)}
              style={[styles.catChip, !activeCategory && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, !activeCategory && styles.catChipTextActive]}>
                {t("store.allCategories")}
              </Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveCategory(item.id)}
              style={[styles.catChip, activeCategory === item.id && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, activeCategory === item.id && styles.catChipTextActive]}>
                {item.nameAr}
              </Text>
            </Pressable>
          )}
        />

        <View style={{ paddingHorizontal: spacing(5), paddingBottom: 24 }}>
          {products.isLoading ? (
            <LoadingScreen />
          ) : (products.data?.length ?? 0) === 0 ? (
            <EmptyState message={t("store.noProducts")} />
          ) : (
            products.data!.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={() => handleAdd(p)} />
            ))
          )}
        </View>
      </ScrollView>

      {cart.lines.length > 0 && cart.storeId === store.data.id && (
        <Pressable style={styles.cartBar} onPress={() => router.push("/cart")}>
          <Text style={styles.cartBarText}>
            {t("cart.title")} · {cart.lines.reduce((n, l) => n + l.quantity, 0)}
          </Text>
          <Text style={styles.cartBarPrice}>{cart.subtotal().toFixed(0)} ج.م</Text>
        </Pressable>
      )}
    </View>
  );
}

function MetaItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.inkMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 180, backgroundColor: colors.primary100 },
  backBtn: {
    position: "absolute",
    top: 50,
    start: 16,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing(5) },
  name: { fontFamily: fonts.headingExtrabold, fontSize: 22, color: colors.ink },
  description: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  catChip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginEnd: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  catChipTextActive: { color: colors.white },
  cartBar: {
    position: "absolute",
    bottom: 16,
    start: 16,
    end: 16,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartBarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 14 },
  cartBarPrice: { fontFamily: fonts.monoSemibold, color: colors.white, fontSize: 14 },
});
