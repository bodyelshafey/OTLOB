import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import * as engagement from "@/lib/endpoints/engagement";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { EmptyState, LoadingScreen } from "@/components/Feedback";
import { t } from "@/i18n";
import type { District } from "@/lib/types";

export default function AddressesScreen() {
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: engagement.getAddresses });
  const districts = useQuery({ queryKey: ["districts"], queryFn: engagement.getDistricts });
  const [adding, setAdding] = useState(false);
  const [fullAddress, setFullAddress] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      engagement.createAddress({ districtId: selectedDistrict!.id, fullAddress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setAdding(false);
      setFullAddress("");
      setSelectedDistrict(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: engagement.deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: t("addresses.title") }} />

      {addresses.isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={addresses.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing(5), gap: 10 }}
          ListEmptyComponent={<EmptyState icon="location-outline" message={t("addresses.noAddresses")} />}
          renderItem={({ item }) => (
            <View style={[styles.card, shadow.card]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.details}>{item.fullAddress}</Text>
                {!!item.district?.nameAr && <Text style={styles.districtLabel}>{item.district.nameAr}</Text>}
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(t("common.delete"), "", [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("common.delete"), style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            adding ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>{t("addresses.district")}</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={districts.data ?? []}
                  keyExtractor={(d: District) => d.id}
                  contentContainerStyle={{ gap: 8, marginBottom: 12 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setSelectedDistrict(item)}
                      style={[
                        styles.districtChip,
                        selectedDistrict?.id === item.id && styles.districtChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.districtChipText,
                          selectedDistrict?.id === item.id && { color: colors.white },
                        ]}
                      >
                        {item.nameAr}
                      </Text>
                    </Pressable>
                  )}
                />
                <FormField
                  label={t("addresses.details")}
                  value={fullAddress}
                  onChangeText={setFullAddress}
                  multiline
                />
                <Button
                  title={t("common.save")}
                  onPress={() => createMutation.mutate()}
                  disabled={!selectedDistrict || !fullAddress}
                  loading={createMutation.isPending}
                />
              </View>
            ) : (
              <Button title={t("checkout.addAddress")} variant="outline" onPress={() => setAdding(true)} style={{ marginTop: 12 }} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: -40 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
  },
  details: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  districtLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginBottom: 8 },
  districtChip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  districtChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  districtChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
});
