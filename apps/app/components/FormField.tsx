import React from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet } from "react-native";
import { colors, fonts, radii } from "@/theme";

export function FormField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, !!error && { borderColor: colors.danger }]}
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 4 },
});
