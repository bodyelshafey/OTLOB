import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts, radii, spacing } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { getAddresses } from "@/lib/endpoints/engagement";
import { usePlaceOrder } from "@/hooks/useOrders";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/Button";
import { PriceText } from "@/components/PriceText";
import { t } from "@/i18n";

export default function Checkout() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const cart = useCartStore();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const placeOrder = usePlaceOrder();

  const [name, setName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [fullAddress, setFullAddress] = useState("");
  const [payment, setPayment] = useState<"CASH" | "CARD">("CASH");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!name && !!phone && !!fullAddress && !!cart.storeId && cart.lines.length > 0;

  const handleSubmit = () => {
    if (!cart.storeId) return;
    setError(null);
    placeOrder.mutate(
      {
        storeId: cart.storeId,
        lines: cart.lines,
        customerName: name,
        phone,
        fullAddress,
        paymentMethod: payment,
      },
      {
        onSuccess: (order) => {
          cart.clear();
          router.replace(`/order/${order.id}`);
        },
        onError: () => setError(t("common.error")),
      }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("checkout.title") }} />
      <ScrollView contentContainerStyle={{ padding: spacing(5) }}>
        <FormField label={t("checkout.name")} value={name} onChangeText={setName} />
        <FormField label={t("checkout.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.sectionLabel}>{t("checkout.address")}</Text>
        {(addresses.data?.length ?? 0) > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {addresses.data!.map((addr) => (
              <Pressable
                key={addr.id}
                onPress={() => setFullAddress(addr.fullAddress)}
                style={[styles.addrOption, fullAddress === addr.fullAddress && styles.addrOptionActive]}
              >
                <Text style={styles.addrText}>{addr.fullAddress}</Text>
                {!!addr.district?.nameAr && <Text style={styles.addrDistrict}>{addr.district.nameAr}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        <FormField
          label={t("checkout.addAddress")}
          value={fullAddress}
          onChangeText={setFullAddress}
          placeholder={t("checkout.address")}
          multiline
        />

        <Text style={styles.sectionLabel}>{t("checkout.paymentMethod")}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <PaymentOption label={t("checkout.cash")} active={payment === "CASH"} onPress={() => setPayment("CASH")} />
          <PaymentOption label={t("checkout.card")} active={payment === "CARD"} onPress={() => setPayment("CARD")} />
        </View>

        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>{t("cart.subtotal")}</Text>
          <PriceText value={cart.subtotal()} size={18} />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={t("checkout.placeOrder")}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={placeOrder.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.payOption, active && styles.payOptionActive]}>
      <Text style={[styles.payText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 10, marginTop: 4 },
  addrOption: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addrOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary50 },
  addrText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  addrDistrict: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  payOption: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  payOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  payText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 16 },
  subtotalLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.body, color: colors.danger, marginBottom: 12, textAlign: "center" },
});
