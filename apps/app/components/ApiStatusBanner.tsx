import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/theme";
import { t } from "@/i18n";
import { endpointManager, useApiEndpoint } from "@/lib/apiEndpoint";

/**
 * Connection feedback driven by lib/apiEndpoint.ts (replaces the old
 * fetch-polling OfflineBanner wiring):
 *  - "unavailable": no API could be reached → message + Retry (all builds).
 *  - on the local fallback: a development-only notice saying which API is in use.
 * Renders nothing in the normal case, so a healthy release build pays no UI cost.
 */
export function ApiStatusBanner() {
  const { status, onFallback, baseUrl, primaryUrl, localUrl } = useApiEndpoint();

  if (status === "unavailable") {
    return (
      <View style={[styles.banner, { backgroundColor: colors.ink }]}>
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
          <Text style={styles.text}>{t("common.offline")}</Text>
          <Pressable
            onPress={() => void endpointManager.retry()}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.retry}
          >
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
        {__DEV__ && (
          <Text style={styles.detail}>
            {`Tried ${[primaryUrl, localUrl].filter(Boolean).join(" and ") || "no API (none configured)"}`}
          </Text>
        )}
      </View>
    );
  }

  if (__DEV__ && onFallback) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.warning }]}>
        <View style={styles.row}>
          <Ionicons name="swap-horizontal" size={16} color={colors.white} />
          <Text style={styles.text}>{`DEV · primary API unreachable — using local API (${baseUrl})`}</Text>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  text: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  detail: { color: colors.white, opacity: 0.8, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: 2 },
  retry: { borderWidth: 1, borderColor: colors.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2 },
  retryText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 },
});
