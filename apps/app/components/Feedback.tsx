import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "@/theme";
import { t } from "@/i18n";
import type { OrderStatus } from "@/lib/types";

export function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function EmptyState({
  icon = "cube-outline",
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
}) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={40} color={colors.inkMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// Shown when a request FAILED (network/auth/server) — deliberately distinct
// from EmptyState so a real failure is never presented as "you have no data".
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <Text style={styles.emptyText}>{message || t("common.error")}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 14 }}>{t("common.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={styles.offlineText}>{t("common.offline")}</Text>
    </View>
  );
}

const statusColor: Record<OrderStatus, string> = {
  PENDING: colors.warning,
  ACCEPTED: colors.primary,
  PREPARING: colors.primary,
  READY: colors.accent,
  DELIVERING: colors.accent,
  COMPLETED: colors.success,
  CANCELLED: colors.danger,
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${statusColor[status]}20` }]}>
      <View style={[styles.dot, { backgroundColor: statusColor[status] }]} />
      <Text style={[styles.badgeText, { color: statusColor[status] }]}>
        {t(`order.status.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8, margin: 24 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  offlineBanner: {
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  offlineText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
});
