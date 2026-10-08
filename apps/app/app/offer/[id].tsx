import React from "react";
import { View, Text, Image, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { getOffer } from "@/lib/endpoints/engagement";
import { useCartStore } from "@/store/cartStore";
import { PriceText } from "@/components/PriceText";
import { Button } from "@/components/Button";
import { LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

export default function OfferDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cart = useCartStore();
  const offer = useQuery({
    queryKey: ["offer", id],
    queryFn: () => getOffer(id as string),
    enabled: !!id,
  });

  if (offer.isLoading || !offer.data) return <LoadingScreen />;

  const data = offer.data;
  const offerStoreId = data.storeId ?? data.store?.id;

  const handleAddToCart = () => {
    // Same store-switch confirmation pattern as store/[id].tsx — don't
    // silently wipe a cart that has items from a different store.
    if (cart.storeId && offerStoreId && cart.storeId !== offerStoreId && cart.lines.length > 0) {
      Alert.alert(t("cart.clearConfirmTitle"), t("cart.clearConfirmBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), onPress: () => cart.addOffer(data) },
      ]);
      return;
    }
    cart.addOffer(data);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        <View>
          <Image source={{ uri: data.image ?? undefined }} style={styles.cover} />
          {data.discountPercentage != null && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>خصم {data.discountPercentage}%</Text>
            </View>
          )}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{data.titleAr}</Text>

          {!!data.store?.name && (
            <Pressable
              style={styles.storeRow}
              onPress={() => offerStoreId && router.push(`/store/${offerStoreId}`)}
            >
              {data.store.image ? (
                <Image source={{ uri: data.store.image }} style={styles.storeAvatar} />
              ) : (
                <View style={[styles.storeAvatar, styles.storeAvatarFallback]}>
                  <Text style={styles.storeAvatarLetter}>{data.store.name.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{data.store.name}</Text>
                <Text style={styles.viewStoreLink}>{t("offer.viewStore")}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
            </Pressable>
          )}

          {!!data.descriptionAr && <Text style={styles.description}>{data.descriptionAr}</Text>}

          <View style={styles.priceRow}>
            {data.newPrice != null && <PriceText value={data.newPrice} size={22} color={colors.primary} />}
            {data.oldPrice != null && (
              <PriceText value={data.oldPrice} size={15} color={colors.inkMuted} strike />
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t("store.addToCart")} onPress={handleAddToCart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 220, backgroundColor: colors.primary100 },
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
  discountBadge: {
    position: "absolute",
    top: 50,
    end: 16,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discountText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 },
  body: { padding: spacing(5), paddingBottom: 100 },
  title: { fontFamily: fonts.headingExtrabold, fontSize: 20, color: colors.ink },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 10,
    marginTop: 12,
  },
  storeAvatar: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.primary100 },
  storeAvatarFallback: { alignItems: "center", justifyContent: "center" },
  storeAvatarLetter: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary700 },
  storeName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  viewStoreLink: { fontFamily: fonts.body, fontSize: 12, color: colors.primary, marginTop: 2 },
  description: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, marginTop: 16, lineHeight: 21 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  footer: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    padding: spacing(5),
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
