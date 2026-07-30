import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  ViewStyle,
  StyleSheet,
} from "react-native";
import { colors, fonts, radii } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.accent },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
};

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.primary },
  danger: { color: colors.white },
};
