import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import * as engagement from "@/lib/endpoints/engagement";
import { EmptyState, LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: engagement.getNotifications });

  const markRead = useMutation({
    mutationFn: engagement.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.notifications") }} />

      {notifications.isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={notifications.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing(5), gap: 10 }}
          ListEmptyComponent={<EmptyState icon="notifications-outline" message={t("favorites.empty")} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => !item.isRead && markRead.mutate(item.id)}
              style={[styles.card, shadow.card, !item.isRead && styles.unread]}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  unread: { borderStartWidth: 3, borderStartColor: colors.primary },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 4 },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
});
