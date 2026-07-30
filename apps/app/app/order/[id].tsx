import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useOrder } from "@/hooks/useOrders";
import { getSocket } from "@/lib/socket";
import { StatusBadge } from "@/components/Feedback";
import { PriceText } from "@/components/PriceText";
import { LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

const STEPS: Array<"PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "DELIVERING" | "COMPLETED"> = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DELIVERING",
  "COMPLETED",
];

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    const onLocation = (payload: { orderId: string; lat: number; lng: number }) => {
      if (payload.orderId !== id) return;
      setDriverLocation({ lat: payload.lat, lng: payload.lng });
    };
    socket.on("driver:location", onLocation);
    return () => {
      socket.off("driver:location", onLocation);
    };
  }, [id]);

  if (order.isLoading || !order.data) return <LoadingScreen />;

  const currentIndex = STEPS.indexOf(order.data.orderStatus as any);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: `${t("order.orderNumber")} #${id?.slice(-6)}` }} />
      <ScrollView>
        {order.data.orderStatus === "DELIVERING" && driverLocation && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            region={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} />
          </MapView>
        )}

        <View style={styles.body}>
          <StatusBadge status={order.data.orderStatus} />

          <View style={styles.timeline}>
            {STEPS.map((step, i) => (
              <View key={step} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    i <= currentIndex && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.timelineText,
                    i <= currentIndex && { color: colors.ink, fontFamily: fonts.bodyBold },
                  ]}
                >
                  {t(`order.status.${step}`)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, shadow.card]}>
            <Text style={styles.cardTitle}>{order.data.fullAddress}</Text>
            <Text style={styles.cardSub}>{order.data.phone}</Text>
          </View>

          {!!order.data.items?.length && (
            <View style={[styles.card, shadow.card]}>
              {order.data.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {item.quantity}× {item.productName}
                  </Text>
                  <PriceText value={item.price * item.quantity} size={13} />
                </View>
              ))}
              <View style={[styles.itemRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                <Text style={[styles.itemName, { fontFamily: fonts.bodyBold }]}>{t("cart.subtotal")}</Text>
                <PriceText value={order.data.total} size={15} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { width: "100%", height: 220 },
  body: { padding: spacing(5), gap: 16 },
  timeline: { gap: 12, marginTop: 8 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  timelineText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  cardTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  itemName: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
});
