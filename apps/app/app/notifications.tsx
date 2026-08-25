import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import * as engagement from "@/lib/endpoints/engagement";
import { EmptyState, LoadingScreen } from "@/components/Feedback";
import { Button } from "@/components/Button";
import { i18n, t } from "@/i18n";
import type { AppNotification } from "@/lib/types";

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  ORDER_STATUS: "receipt-outline",
  PROMO: "pricetag-outline",
  SYSTEM: "information-circle-outline",
  ADMIN_ANNOUNCEMENT: "megaphone-outline",
};

function localized(item: AppNotification) {
  const isAr = i18n.locale === "ar";
  return {
    title: (isAr ? item.titleAr : item.titleEn) ?? item.titleAr ?? item.titleEn ?? "",
    body: (isAr ? item.bodyAr : item.bodyEn) ?? item.bodyAr ?? item.bodyEn ?? "",
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => engagement.getNotifications(),
  });

  const markRead = useMutation({
    mutationFn: engagement.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: engagement.markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handlePress = (item: AppNotification) => {
    if (!item.isRead) markRead.mutate(item.id);
    const orderId = item.data?.orderId as string | undefined;
    const storeId = item.data?.storeId as string | undefined;
    if (orderId) router.push(`/order/${orderId}`);
    else if (storeId) router.push(`/store/${storeId}`);
  };

  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          title: t("notif.title"),
          headerRight:
            unreadCount > 0
              ? () => (
                  <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
                    <Text style={styles.markAllText}>{t("notif.markAllRead")}</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />

      {notifications.isLoading ? (
        <LoadingScreen />
      ) : notifications.isError ? (
        <View style={styles.centered}>
          <EmptyState icon="warning-outline" message={t("notif.error")} />
          <Button title={t("notif.retry")} onPress={() => notifications.refetch()} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <FlatList
          data={notifications.data?.items ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing(5), gap: 10, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={notifications.isFetching} onRefresh={() => notifications.refetch()} />
          }
          ListEmptyComponent={<EmptyState icon="notifications-outline" message={t("notif.empty")} />}
          renderItem={({ item }) => {
            const { title, body } = localized(item);
            return (
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.card,
                  shadow.card,
                  !item.isRead && styles.unread,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={TYPE_ICON[item.type] ?? "notifications-outline"}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {title}
                    </Text>
                    {!item.isRead && <View style={styles.dot} />}
                  </View>
                  {!!body && (
                    <Text style={styles.body} numberOfLines={2}>
                      {body}
                    </Text>
                  )}
                  <Text style={styles.time}>
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: i18n.locale === "ar" ? ar : enUS,
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(5) },
  markAllText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary },
  card: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
  },
  unread: { borderStartWidth: 3, borderStartColor: colors.primary },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 3 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 6, opacity: 0.7 },
});
