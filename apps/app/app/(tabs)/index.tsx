import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useStoreTypes, useStores } from "@/hooks/useCatalog";
import { getOffers } from "@/lib/endpoints/engagement";
import { StoreCard } from "@/components/StoreCard";
import { PriceText } from "@/components/PriceText";
import { LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

export default function Home() {
  const router = useRouter();
  const storeTypes = useStoreTypes();
  const stores = useStores({ limit: 12 });
  const offers = useQuery({ queryKey: ["offers", "home"], queryFn: () => getOffers() });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.searchBar} onPress={() => router.push("/(tabs)/stores")}>
            <Ionicons name="search" size={18} color={colors.inkMuted} />
            <Text style={styles.searchPlaceholder}>{t("home.searchPlaceholder")}</Text>
          </Pressable>
        </View>

        <Section title={t("home.storeTypes")}>
          {storeTypes.isLoading ? (
            <LoadingScreen />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={storeTypes.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing(5) }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.typeChip}
                  onPress={() => router.push({ pathname: "/(tabs)/stores", params: { storeTypeId: item.id } })}
                >
                  <Text style={styles.typeChipText}>{item.nameAr}</Text>
                </Pressable>
              )}
            />
          )}
        </Section>

        {(offers.data?.length ?? 0) > 0 && (
          <Section title={t("home.todaysOffers")}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={offers.data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing(5) }}
              renderItem={({ item }) => (
                <View style={[styles.offerCard, shadow.card]}>
                  {item.discountPercentage != null && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>خصم {item.discountPercentage}%</Text>
                    </View>
                  )}
                  <Text style={styles.offerTitle} numberOfLines={1}>
                    {item.titleAr}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {item.newPrice != null && <PriceText value={item.newPrice} size={14} color={colors.white} />}
                    {item.oldPrice != null && (
                      <PriceText value={item.oldPrice} size={12} color="rgba(255,255,255,0.7)" strike />
                    )}
                  </View>
                </View>
              )}
            />
          </Section>
        )}

        <Section title={t("home.nearbyStores")}>
          {stores.isLoading ? (
            <LoadingScreen />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={stores.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing(5) }}
              renderItem={({ item }) => <StoreCard store={item} />}
            />
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing(6) }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing(5) },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow.card,
  },
  searchPlaceholder: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
  sectionTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: colors.ink,
    paddingHorizontal: spacing(5),
    marginBottom: 10,
  },
  typeChip: {
    backgroundColor: colors.primary100,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginEnd: 10,
  },
  typeChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  offerCard: {
    width: 220,
    height: 110,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 14,
    marginEnd: 12,
    justifyContent: "flex-end",
  },
  discountBadge: {
    position: "absolute",
    top: 10,
    start: 10,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  offerTitle: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.white, marginBottom: 6 },
});
