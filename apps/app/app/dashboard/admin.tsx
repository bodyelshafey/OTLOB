import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/Feedback";
import { colors } from "@/theme";
import { t } from "@/i18n";

// Placeholder — full admin dashboard (platform overview, store directory,
// store type management, user directory, coupon management) is the next
// build pass.
export default function AdminDashboardPlaceholder() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.adminDashboard") }} />
      <EmptyState icon="shield-checkmark-outline" message="Admin dashboard — coming in the next build pass." />
    </SafeAreaView>
  );
}
