import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Image,
  Alert,
  Switch,
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { t } from "@/i18n";
import { LoadingScreen, EmptyState, StatusBadge } from "@/components/Feedback";
import { Button } from "@/components/Button";
import { PriceText } from "@/components/PriceText";
import { getMyStore, getCategories, createCategory, getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/endpoints/catalog";
import { getStoreReport } from "@/lib/endpoints/management";
import { getStoreOrders, updateOrderStatus } from "@/lib/endpoints/orders";
import { getMyOffers, createOffer, updateOffer, deleteOffer, toggleOfferActive, uploadImage } from "@/lib/endpoints/engagement";
import type { Product, Offer, OrderStatus } from "@/lib/types";

type Tab = "overview" | "orders" | "products" | "offers";

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; labelKey: string }>> = {
  PENDING: { next: "ACCEPTED", labelKey: "dashboard.acceptOrder" },
  ACCEPTED: { next: "PREPARING", labelKey: "dashboard.startPreparing" },
  PREPARING: { next: "READY", labelKey: "dashboard.markReady" },
  READY: { next: "DELIVERING", labelKey: "dashboard.outForDelivery" },
  DELIVERING: { next: "COMPLETED", labelKey: "dashboard.markDelivered" },
};

export default function StoreDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  const store = useQuery({ queryKey: ["my-store"], queryFn: getMyStore });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.storeDashboard") }} />

      <View style={styles.tabBar}>
        {(["overview", "orders", "products", "offers"] as Tab[]).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tabChip, tab === key && styles.tabChipActive]}>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{t(`dashboard.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {store.isLoading ? (
        <LoadingScreen />
      ) : !store.data ? (
        <EmptyState icon="storefront-outline" message={t("common.error")} />
      ) : tab === "overview" ? (
        <OverviewTab storeId={store.data.id} />
      ) : tab === "orders" ? (
        <OrdersTab storeId={store.data.id} />
      ) : tab === "products" ? (
        <ProductsTab storeId={store.data.id} storeTypeId={store.data.storeType?.id ?? ""} />
      ) : (
        <OffersTab storeId={store.data.id} />
      )}
    </SafeAreaView>
  );
}

// --- Overview ---------------------------------------------------------

function OverviewTab({ storeId }: { storeId: string }) {
  const report = useQuery({ queryKey: ["store-report", storeId], queryFn: () => getStoreReport(storeId) });

  if (report.isLoading) return <LoadingScreen />;
  const data = report.data as any;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(5), gap: 10 }}>
      <View style={styles.statsGrid}>
        <StatCard label={t("dashboard.totalOrders")} value={String(data?.ordersCompleted ?? 0)} />
        <StatCard label={t("dashboard.totalRevenue")} value={`${data?.totalRevenue ?? 0} ج.م`} accent />
        <StatCard label={t("dashboard.averageRating")} value={Number(data?.averageRating ?? 0).toFixed(1)} />
      </View>

      <Text style={styles.sectionHeading}>{t("dashboard.commission")}</Text>
      <View style={styles.statsGrid}>
        <StatCard label={t("dashboard.commissionRate")} value={`${data?.commissionPercentage ?? 10}%`} />
        <StatCard label={t("dashboard.amountOwed")} value={`${data?.totalCommissionPaid ?? 0} ج.م`} accent />
        <StatCard label={t("dashboard.netEarnings")} value={`${data?.netEarnings ?? 0} ج.م`} />
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

// --- Orders -------------------------------------------------------------

function OrdersTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["store-orders", storeId],
    queryFn: () => getStoreOrders(storeId),
    refetchInterval: 15_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-orders", storeId] }),
  });

  if (orders.isLoading) return <LoadingScreen />;
  if (!orders.data?.length) return <EmptyState icon="receipt-outline" message={t("dashboard.noOrders")} />;

  return (
    <FlatList
      data={orders.data}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: spacing(5), gap: 10 }}
      renderItem={({ item }) => {
        const action = NEXT_STATUS[item.orderStatus];
        return (
          <View style={[styles.card, shadow.card]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{item.customerName}</Text>
              <StatusBadge status={item.orderStatus} />
            </View>
            <Text style={styles.mutedText}>{item.fullAddress}</Text>
            <View style={styles.chipsRow}>
              {item.items?.map((line) => (
                <View key={line.id} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>
                    {line.productName} × {line.quantity}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.cardFooterRow}>
              <PriceText value={item.total} size={16} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {item.orderStatus !== "CANCELLED" && item.orderStatus !== "COMPLETED" && (
                  <Pressable
                    onPress={() => updateStatus.mutate({ id: item.id, status: "CANCELLED" })}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
                  </Pressable>
                )}
                {action && (
                  <Pressable
                    onPress={() => updateStatus.mutate({ id: item.id, status: action.next })}
                    style={styles.acceptBtn}
                  >
                    <Text style={styles.acceptBtnText}>{t(action.labelKey)}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

// --- Products -------------------------------------------------------------

interface ProductFormState {
  id?: string;
  name: string;
  price: string;
  image: string;
  categoryId: string;
  isAvailable: boolean;
}

function ProductsTab({ storeId, storeTypeId }: { storeId: string; storeTypeId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const categories = useQuery({ queryKey: ["categories", storeId], queryFn: () => getCategories(storeId) });
  const products = useQuery({
    queryKey: ["products", "mine", storeId],
    queryFn: () => getProducts({ storeId, limit: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products", "mine", storeId] });

  const save = useMutation({
    mutationFn: (payload: ProductFormState) => {
      const body: Partial<Product> = {
        name: payload.name,
        price: Number(payload.price),
        image: payload.image || undefined,
        categoryId: payload.categoryId,
        isAvailable: payload.isAvailable,
        storeId,
      };
      return payload.id ? updateProduct(payload.id, body) : createProduct(body);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: invalidate,
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted || !form) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const { url } = await uploadImage({ uri: asset.uri, name: "product.jpg", type: "image/jpeg" }, "products");
      setForm({ ...form, image: url });
    } finally {
      setUploading(false);
    }
  };

  if (products.isLoading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={products.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing(5), gap: 10, paddingBottom: 90 }}
        ListEmptyComponent={<EmptyState icon="fast-food-outline" message={t("dashboard.noProducts")} />}
        renderItem={({ item }) => (
          <View style={[styles.row, shadow.card]}>
            <Image source={{ uri: item.image ?? undefined }} style={styles.rowImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <PriceText value={item.price} size={14} />
              <Text style={styles.mutedTextSmall}>
                {item.isAvailable ? t("dashboard.available") : t("dashboard.unavailable")}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Pressable
                onPress={() =>
                  setForm({
                    id: item.id,
                    name: item.name,
                    price: String(item.price),
                    image: item.image ?? "",
                    categoryId: item.categoryId,
                    isAvailable: item.isAvailable,
                  })
                }
                style={styles.iconBtn}
              >
                <Ionicons name="pencil" size={14} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => remove.mutate(item.id)} style={[styles.iconBtn, styles.iconBtnDanger]}>
                <Ionicons name="trash" size={14} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() =>
          setForm({ name: "", price: "", image: "", categoryId: categories.data?.[0]?.id ?? "", isAvailable: true })
        }
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </Pressable>

      {form && (
        <FormModal title={form.id ? t("common.edit") : t("dashboard.newProduct")} onClose={() => setForm(null)}>
          <Pressable onPress={pickImage} style={styles.imagePicker}>
            {form.image ? (
              <Image source={{ uri: form.image }} style={styles.imagePreview} />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.primary700} />
            )}
            <Text style={styles.imagePickerText}>{uploading ? t("dashboard.uploading") : t("dashboard.chooseImage")}</Text>
          </Pressable>
          <TextInput
            placeholder={t("dashboard.productName")}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            style={styles.input}
          />
          <TextInput
            placeholder={t("dashboard.price")}
            value={form.price}
            onChangeText={(v) => setForm({ ...form, price: v })}
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.categoryRow}>
            {(categories.data ?? []).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setForm({ ...form, categoryId: c.id })}
                style={[styles.categoryChip, form.categoryId === c.id && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, form.categoryId === c.id && styles.categoryChipTextActive]}>
                  {c.nameAr}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("dashboard.available")}</Text>
            <Switch
              value={form.isAvailable}
              onValueChange={(v) => setForm({ ...form, isAvailable: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <Button
            title={save.isPending ? t("dashboard.saving") : t("common.save")}
            onPress={() => save.mutate(form)}
            loading={save.isPending}
            disabled={!form.name || !form.price || !form.categoryId || uploading}
            style={{ marginTop: 4 }}
          />
        </FormModal>
      )}
    </View>
  );
}

// --- Offers -------------------------------------------------------------

interface OfferFormState {
  id?: string;
  titleAr: string;
  oldPrice: string;
  newPrice: string;
  discountPercentage: string;
  image: string;
}

function OffersTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfferFormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const offers = useQuery({ queryKey: ["offers", "mine", storeId], queryFn: () => getMyOffers(storeId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["offers", "mine", storeId] });

  const save = useMutation({
    mutationFn: (payload: OfferFormState) => {
      const body: Partial<Offer> = {
        titleAr: payload.titleAr,
        titleEn: payload.titleAr,
        oldPrice: payload.oldPrice ? Number(payload.oldPrice) : undefined,
        newPrice: payload.newPrice ? Number(payload.newPrice) : undefined,
        discountPercentage: payload.discountPercentage ? Number(payload.discountPercentage) : undefined,
        image: payload.image || undefined,
        storeId,
      };
      return payload.id ? updateOffer(payload.id, body) : createOffer(body);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const remove = useMutation({ mutationFn: (id: string) => deleteOffer(id), onSuccess: invalidate });
  const toggle = useMutation({ mutationFn: (id: string) => toggleOfferActive(id), onSuccess: invalidate });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted || !form) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const { url } = await uploadImage({ uri: asset.uri, name: "offer.jpg", type: "image/jpeg" }, "offers");
      setForm({ ...form, image: url });
    } finally {
      setUploading(false);
    }
  };

  if (offers.isLoading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={offers.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing(5), gap: 10, paddingBottom: 90 }}
        ListEmptyComponent={<EmptyState icon="pricetags-outline" message={t("dashboard.noOffers")} />}
        renderItem={({ item }) => (
          <View style={[styles.row, shadow.card]}>
            <Image source={{ uri: item.image ?? undefined }} style={styles.rowImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.titleAr}
              </Text>
              {item.newPrice != null && <PriceText value={item.newPrice} size={14} />}
              <Text style={[styles.mutedTextSmall, { color: item.isActive ? colors.success : colors.inkMuted }]}>
                {item.isActive ? t("dashboard.active") : t("dashboard.inactive")}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Pressable onPress={() => toggle.mutate(item.id)} style={styles.iconBtn}>
                <Ionicons name="power" size={14} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() =>
                  setForm({
                    id: item.id,
                    titleAr: item.titleAr,
                    oldPrice: item.oldPrice != null ? String(item.oldPrice) : "",
                    newPrice: item.newPrice != null ? String(item.newPrice) : "",
                    discountPercentage: item.discountPercentage != null ? String(item.discountPercentage) : "",
                    image: item.image ?? "",
                  })
                }
                style={styles.iconBtn}
              >
                <Ionicons name="pencil" size={14} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => remove.mutate(item.id)} style={[styles.iconBtn, styles.iconBtnDanger]}>
                <Ionicons name="trash" size={14} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => setForm({ titleAr: "", oldPrice: "", newPrice: "", discountPercentage: "", image: "" })}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </Pressable>

      {form && (
        <FormModal title={form.id ? t("common.edit") : t("dashboard.newOffer")} onClose={() => setForm(null)}>
          <Pressable onPress={pickImage} style={styles.imagePicker}>
            {form.image ? (
              <Image source={{ uri: form.image }} style={styles.imagePreview} />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.primary700} />
            )}
            <Text style={styles.imagePickerText}>{uploading ? t("dashboard.uploading") : t("dashboard.chooseImage")}</Text>
          </Pressable>
          <TextInput
            placeholder={t("offer.title")}
            value={form.titleAr}
            onChangeText={(v) => setForm({ ...form, titleAr: v })}
            style={styles.input}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              placeholder={t("dashboard.oldPrice")}
              value={form.oldPrice}
              onChangeText={(v) => setForm({ ...form, oldPrice: v })}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              placeholder={t("dashboard.newPrice")}
              value={form.newPrice}
              onChangeText={(v) => setForm({ ...form, newPrice: v })}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <TextInput
            placeholder="%"
            value={form.discountPercentage}
            onChangeText={(v) => setForm({ ...form, discountPercentage: v })}
            keyboardType="numeric"
            style={styles.input}
          />
          <Button
            title={save.isPending ? t("dashboard.saving") : t("common.save")}
            onPress={() => save.mutate(form)}
            loading={save.isPending}
            disabled={!form.titleAr || uploading}
            style={{ marginTop: 4 }}
          />
        </FormModal>
      )}
    </View>
  );
}

// --- Shared bottom-sheet-style form modal --------------------------------

function FormModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: "row", gap: 8, paddingHorizontal: spacing(5), paddingVertical: 10 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.white },
  tabChipActive: { backgroundColor: colors.primary },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  tabLabelActive: { color: colors.white },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flexBasis: "31%", flexGrow: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: 12 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
  statValue: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.ink, marginTop: 4 },
  sectionHeading: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.ink, marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  mutedText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 4 },
  mutedTextSmall: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  itemChip: { backgroundColor: colors.primary100, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  itemChipText: { fontFamily: fonts.body, fontSize: 11, color: colors.primary700 },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
  },
  cancelBtn: { backgroundColor: `${colors.danger}15`, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  cancelBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.danger },
  acceptBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  acceptBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: radii.lg, padding: 10 },
  rowImage: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.primary100 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: { backgroundColor: `${colors.danger}15` },
  fab: {
    position: "absolute",
    bottom: 20,
    end: 20,
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    bottom: 0,
    backgroundColor: "rgba(11,37,48,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing(5),
    maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.ink },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.primary100,
    borderRadius: radii.md,
    padding: 10,
  },
  imagePreview: { width: 44, height: 44, borderRadius: radii.md },
  imagePickerText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary700 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary100,
  },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary700 },
  categoryChipTextActive: { color: colors.white },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  switchLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
});
