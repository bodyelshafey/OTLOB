import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/Feedback";
import { colors } from "@/theme";
import { t } from "@/i18n";

// Placeholder — the full store-owner/employee dashboard (overview stats,
// product & category CRUD, offers, live order management, employees) is
// the next build pass. This route exists so profile navigation for
// STORE_OWNER/EMPLOYEE roles doesn't dead-end in the meantime.
export default function StoreDashboardPlaceholder() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ title: t("profile.storeDashboard") }} />
      <EmptyState icon="storefront-outline" message="Store dashboard — coming in the next build pass." />
    </SafeAreaView>
  );
}
