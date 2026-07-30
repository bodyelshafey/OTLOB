import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/Feedback";
import { colors } from "@/theme";
import { t } from "@/i18n";

// Placeholder — full driver dashboard (online toggle, available orders,
// accept flow, deliveries history, background location updates) is the
// next build pass.
export default function DriverDashboardPlaceholder() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.driverDashboard") }} />
      <EmptyState icon="bicycle-outline" message="Driver dashboard — coming in the next build pass." />
    </SafeAreaView>
  );
}
