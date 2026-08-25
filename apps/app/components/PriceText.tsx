import React from "react";
import { Text, TextStyle } from "react-native";
import { colors, fonts, CURRENCY_SUFFIX } from "@/theme";

export function PriceText({
  value,
  size = 16,
  color = colors.ink,
  strike = false,
  style,
}: {
  value?: number | null;
  size?: number;
  color?: string;
  strike?: boolean;
  style?: TextStyle;
}) {
  const price = Number(value ?? 0);

  return (
    <Text
      style={[
        {
          fontFamily: fonts.monoSemibold,
          fontSize: size,
          color,
          textDecorationLine: strike ? "line-through" : "none",
        },
        style,
      ]}
    >
      {price.toFixed(0)} {CURRENCY_SUFFIX}
    </Text>
  );
}
