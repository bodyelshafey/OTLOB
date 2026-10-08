import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useMyOrders } from "@/hooks/useOrders";
import { StatusBadge, EmptyState, LoadingScreen } from "@/components/Feedback";
import { PriceText } from "@/components/PriceText";
import { t } from "@/i18n";

export default function OrdersScreen() {
  const router = useRouter();
  const orders = useMyOrders();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>{t("order.history")}</Text>

      {orders.isLoading ? (
        <LoadingScreen />
      ) : (orders.data?.length ?? 0) === 0 ? (
        <EmptyState icon="receipt-outline" message={t("order.noOrders")} />
      ) : (
        <FlatList
          data={orders.data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing(5), gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, shadow.card]}
              onPress={() => router.push(`/order/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>
                  {item.store?.name ?? `${t("order.orderNumber")} #${item.id.slice(-6)}`}
                </Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <StatusBadge status={item.orderStatus} />
              </View>
              <PriceText value={item.total} />
            </Pressable>
          )}
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
    paddingVertical: spacing(4),
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
  },
  orderNum: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 4 },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginBottom: 8 },
});
