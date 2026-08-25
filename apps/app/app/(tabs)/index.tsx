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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useStoreTypes, useStores } from "@/hooks/useCatalog";
import { getOffers, getBanners } from "@/lib/endpoints/engagement";
import { StoreCard } from "@/components/StoreCard";
import { PriceText } from "@/components/PriceText";
import { AdsCarousel } from "@/components/AdsCarousel";
import { HangingDecorations } from "@/components/decor/HangingDecorations";
import { LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

export default function Home() {
  const router = useRouter();
  const storeTypes = useStoreTypes();
  const stores = useStores({ limit: 12 });
  const offers = useQuery({ queryKey: ["offers", "home"], queryFn: () => getOffers({ home: true }) });
  const banners = useQuery({ queryKey: ["banners", "home"], queryFn: () => getBanners() });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Purely decorative — overlays the top of the white box below,
          doesn't affect touches or layout (see HangingDecorations). */}
      <HangingDecorations />
      <ScrollView showsVerticalScrollIndicator={false}>
          <Section style={styles.box}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("home.title")}<Text style={styles.mark}> {t("home.mark")}</Text></Text>
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
                  style={styles.typeItem}
                  onPress={() => router.push({ pathname: "/(tabs)/stores", params: { storeTypeId: item.id } })}
                >
                  <View style={styles.typeImageWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.typeImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.typeFallback}>{item.nameAr.charAt(0)}</Text>
                    )}
                  </View>
                  <Text style={styles.typeName} numberOfLines={1}>
                    {item.nameAr}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </Section>

        {(banners.data?.length ?? 0) > 0 && <AdsCarousel items={banners.data ?? []} />}

        {(offers.data?.length ?? 0) > 0 && (
          <Section
            title={t("home.todaysOffers")}
            action={{ label: t("home.seeMoreOffers"), onPress: () => router.push("/offers") }}
          >
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={offers.data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing(5) }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.offerCard, shadow.card, pressed && { opacity: 0.9 }]}
                  onPress={() => router.push(`/offer/${item.id}`)}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.offerImage} />
                  ) : null}
                  {item.discountPercentage != null && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>خصم {item.discountPercentage}%</Text>
                    </View>
                  )}
                  <Text style={styles.offerTitle} numberOfLines={1}>
                    {item.titleAr}
                  </Text>
                  {!!item.store?.name && (
                    <Text style={styles.offerStoreName} numberOfLines={1}>
                      {item.store.name}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {item.newPrice != null && <PriceText value={item.newPrice} size={14} color={colors.white} />}
                    {item.oldPrice != null && (
                      <PriceText value={item.oldPrice} size={12} color="rgba(255,255,255,0.7)" strike />
                    )}
                  </View>
                </Pressable>
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
              contentContainerStyle={{ paddingHorizontal: spacing(5), paddingBottom: spacing(2) }}
              renderItem={({ item }) => <StoreCard store={item} />}
            />
          )}
        </Section>
      </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  style,
  children,
  action,
}: {
  title?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={[{ marginBottom: spacing(6) }, style]}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {action ? (
            <Pressable onPress={action.onPress} hitSlop={8}>
              <Text style={styles.sectionAction}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#dff7ff",paddingTop: -40,paddingBottom: spacing(0),height:"100%",position: "absolute" },
  box: {backgroundColor: "#fff", margin: 15, borderRadius: 30, boxShadow: "0 10px 30px rgba(0,0,0,.08)", height:"93%",minHeight:"93%",paddingBottom: spacing(8)},
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
  title: { fontFamily: fonts.headingBold, fontSize: 30, color: '#009cae', marginBottom: 12 },
  mark: { fontFamily: fonts.headingBold, fontSize: 30, color: '#ae0000' },
  searchPlaceholder: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(5),
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: colors.ink,
  },
  sectionAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  typeItem: { alignItems: "center", width: 76, marginEnd: 12, gap: 6 },
  typeImageWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primary100,
    ...shadow.card,
  },
  typeImage: { width: "100%", height: "100%" },
  typeFallback: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.primary },
  typeName: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink, textAlign: "center" },
  offerCard: {
    width: 220,
    height: 110,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 14,
    marginEnd: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  offerImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  offerStoreName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: -2,
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
  discountText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10, },
  offerTitle: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.white, marginBottom: -5 },
});
