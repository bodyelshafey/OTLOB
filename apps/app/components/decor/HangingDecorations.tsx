import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

const ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "star-outline",
  "moon-outline",
  "fast-food-outline",
  "bicycle-outline",
  "pizza-outline",
  "cafe-outline",
  "star-outline",
  "cube-outline",
  "moon-outline",
];

// Purely decorative "hanging strings" draped over the top edge of the white
// content box — golden/amber, low opacity, thin lines only. Rendered as the
// FIRST child inside the box and positioned absolute, so normal-flow
// siblings that come after it (the title, search bar, everything else)
// paint on top and stay fully visible/tappable. pointerEvents="none" so it
// never intercepts a touch, and it only occupies a fixed top strip so it
// can't push/shift any layout below it.
export function HangingDecorations() {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {ICONS.map((name, i) => {
        const leftPercent = `${(100 / ICONS.length) * i + 3}%` as const;
        const length = 14 + ((i * 11) % 26);
        return (
          <View key={i} style={[styles.item, { left: leftPercent }]}>
            <View style={[styles.string, { height: length }]} />
            <Ionicons name={name} size={15} color={colors.warning} style={{ opacity: 0.55 }} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Negative top so the strings appear to hang from just above the box's
  // rounded edge, with the icons ending up a bit inside it — never so far
  // down that they'd sit behind the title text or search bar below.
  wrap: {
    position: "absolute",
    top: -18,
    left: 0,
    right: 0,
    height: 48,
    overflow: "hidden",
    zIndex: 0,
  },
  item: { position: "absolute", top: 0, alignItems: "center" },
  string: { width: 1, backgroundColor: "rgba(245,166,35,0.45)" },
});
