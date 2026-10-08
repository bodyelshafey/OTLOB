import React from "react";
import { View, Text, Image, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { getOffers } from "@/lib/endpoints/engagement";
import { PriceText } from "@/components/PriceText";
import { LoadingScreen, EmptyState } from "@/components/Feedback";
import { t } from "@/i18n";

export default function AllOffers() {
  const router = useRouter();
  const offers = useQuery({ queryKey: ["offers", "all"], queryFn: () => getOffers() });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("offer.allOffers") }} />
      {offers.isLoading ? (
        <LoadingScreen />
      ) : (offers.data?.length ?? 0) === 0 ? (
        <EmptyState icon="pricetags-outline" message={t("offer.empty")} />
      ) : (
        <FlatList
          data={offers.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: spacing(5), gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.9 }]}
              onPress={() => router.push(`/offer/${item.id}`)}
            >
              <View style={styles.imageWrap}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : null}
                {item.discountPercentage != null && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>خصم {item.discountPercentage}%</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.titleAr}
                </Text>
                {!!item.store?.name && (
                  <Text style={styles.storeName} numberOfLines={1}>
                    {item.store.name}
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  {item.newPrice != null && <PriceText value={item.newPrice} size={14} />}
                  {item.oldPrice != null && <PriceText value={item.oldPrice} size={11} color={colors.inkMuted} strike />}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  imageWrap: { height: 90, backgroundColor: colors.primary100 },
  image: { width: "100%", height: "100%" },
  discountBadge: {
    position: "absolute",
    top: 8,
    start: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  cardBody: { padding: 10 },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  storeName: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
});
