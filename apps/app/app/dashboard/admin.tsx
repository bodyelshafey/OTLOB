import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, TextInput, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { t } from "@/i18n";
import { LoadingScreen, EmptyState, StatusBadge } from "@/components/Feedback";
import { getPlatformReport } from "@/lib/endpoints/management";
import { getStores, toggleStoreOpen, suspendStore } from "@/lib/endpoints/catalog";
import { getAllOrdersAdmin } from "@/lib/endpoints/orders";
import type { OrderStatus } from "@/lib/types";

type Tab = "overview" | "stores" | "orders";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.adminDashboard") }} />

      <View style={styles.tabBar}>
        {(["overview", "stores", "orders"] as Tab[]).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tabChip, tab === key && styles.tabChipActive]}>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{t(`dashboard.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "overview" ? <OverviewTab /> : tab === "stores" ? <StoresTab /> : <OrdersTab />}
    </SafeAreaView>
  );
}

// --- Overview ---------------------------------------------------------

function OverviewTab() {
  const report = useQuery({ queryKey: ["platform-report"], queryFn: getPlatformReport });
  if (report.isLoading) return <LoadingScreen />;
  const data = report.data as any;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(5), gap: 10 }}>
      <Text style={styles.sectionHeading}>{t("dashboard.platformOverview")}</Text>
      <View style={styles.statsGrid}>
        <StatCard label={t("dashboard.totalRevenue")} value={`${data?.totalGMV ?? 0} ج.م`} accent />
        <StatCard label={t("dashboard.commission")} value={`${data?.totalCommissionEarned ?? 0} ج.م`} />
        <StatCard label={t("dashboard.totalOrders")} value={String(data?.ordersCount ?? 0)} />
        <StatCard label={t("dashboard.storesCount")} value={String(data?.storesCount ?? 0)} />
        <StatCard label={t("dashboard.usersCount")} value={String(data?.usersCount ?? 0)} />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statCard, shadow.card]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

// --- Stores -------------------------------------------------------------

function StoresTab() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const stores = useQuery({
    queryKey: ["admin-stores", search],
    queryFn: () => getStores({ search: search || undefined, limit: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
  const toggleOpen = useMutation({ mutationFn: (id: string) => toggleStoreOpen(id), onSuccess: invalidate });
  const suspend = useMutation({ mutationFn: (id: string) => suspendStore(id), onSuccess: invalidate });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.inkMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("common.search")}
          style={styles.searchInput}
        />
      </View>

      {stores.isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={stores.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing(5), gap: 10 }}
          ListEmptyComponent={<EmptyState icon="storefront-outline" message={t("dashboard.noProducts")} />}
          renderItem={({ item }) => (
            <View style={[styles.row, shadow.card]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.pill, { backgroundColor: item.isOpen ? `${colors.success}15` : `${colors.danger}15` }]}>
                  <Text style={[styles.pillText, { color: item.isOpen ? colors.success : colors.danger }]}>
                    {item.isOpen ? t("dashboard.openStore") : t("dashboard.closeStore")}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => toggleOpen.mutate(item.id)} style={styles.iconBtn}>
                  <Ionicons name="power" size={14} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert(t("dashboard.suspendStore"), t("dashboard.suspendConfirm"), [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("common.confirm"), style: "destructive", onPress: () => suspend.mutate(item.id) },
                    ])
                  }
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                >
                  <Ionicons name="ban" size={14} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// --- Orders (admin, all stores) -----------------------------------------

function OrdersTab() {
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => getAllOrdersAdmin() });

  if (orders.isLoading) return <LoadingScreen />;
  if (!orders.data?.length) return <EmptyState icon="receipt-outline" message={t("dashboard.noOrders")} />;

  return (
    <FlatList
      data={orders.data}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: spacing(5), gap: 10 }}
      renderItem={({ item }) => (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{item.store?.name ?? "—"}</Text>
            <StatusBadge status={item.orderStatus as OrderStatus} />
          </View>
          <Text style={styles.mutedText}>
            {item.user?.fullName ?? item.customerName} · {item.user?.phone ?? item.phone}
          </Text>
          <View style={styles.cardFooterRow}>
            <Text style={styles.totalText}>{item.total} ج.م</Text>
            {item.commission != null && <Text style={styles.mutedTextSmall}>عمولة: {item.commission} ج.م</Text>}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: "row", gap: 8, paddingHorizontal: spacing(5), paddingVertical: 10 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.white },
  tabChipActive: { backgroundColor: colors.primary },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  tabLabelActive: { color: colors.white },
  sectionHeading: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.ink },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flexBasis: "31%", flexGrow: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: 12 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
  statValue: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.ink, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing(5),
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: radii.lg, padding: 12 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  mutedText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 4 },
  mutedTextSmall: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
  },
  totalText: { fontFamily: fonts.headingBold, fontSize: 14, color: colors.primary700 },
  pill: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: { backgroundColor: `${colors.danger}15` },
});
