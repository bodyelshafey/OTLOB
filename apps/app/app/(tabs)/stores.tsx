import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import { useStores } from "@/hooks/useCatalog";
import { StoreCard } from "@/components/StoreCard";
import { EmptyState, LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";

export default function StoresScreen() {
  const params = useLocalSearchParams<{ storeTypeId?: string }>();
  const [search, setSearch] = useState("");
  const stores = useStores({ storeTypeId: params.storeTypeId, search: search || undefined });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />
        </View>
      </View>

      {stores.isLoading ? (
        <LoadingScreen />
      ) : (stores.data?.length ?? 0) === 0 ? (
        <EmptyState icon="storefront-outline" message={t("common.error")} />
      ) : (
        <FlatList
          data={stores.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: spacing(5) }}
          contentContainerStyle={{ gap: 12, paddingBottom: spacing(6) }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <StoreCard store={item} fullWidth />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing(5) },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow.card,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
});
