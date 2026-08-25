import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "star-outline",
  "moon-outline",
  "fast-food-outline",
  "bicycle-outline",
  "pizza-outline",
  "cafe-outline",
  "star-outline",
  "ellipse-outline",
  "moon-outline",
];

// Purely decorative "hanging strings" — positioned to overlay the very top
// of the white content box (dipping down onto it, like the reference
// image), not just the colored margin above it. Deliberately:
// - pointerEvents="none" so it never intercepts a tap
// - very low opacity so the title/search underneath stay fully readable
// - absolutely positioned with fixed pixel heights (no % width math needed
//   on native), so it can't affect the layout of anything around it
export function HangingDecorations() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      {ICONS.map((name, i) => {
        const left = `${(100 / ICONS.length) * i + 3}%`;
        // Alternating string lengths, matching the reference's uneven
        // hanging heights.
        const length = 26 + ((i * 13) % 30);
        return (
          <View key={i} style={[styles.item, { left: left as any }]}>
            <View style={[styles.string, { height: length }]} />
            <Ionicons name={name} size={14} color="#f5c518" style={{ opacity: 0.55 }} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Height chosen so the icons' tips land just inside the white box's top
  // edge (the box itself starts ~15px from the screen top) — the strings
  // visibly "hang onto" the box instead of stopping above it.
  wrap: { position: "absolute", top: 0, left: 0, right: 0, height: 70, zIndex: 20 },
  item: { position: "absolute", top: 0, alignItems: "center" },
  string: { width: 1, backgroundColor: "rgba(245,197,24,0.5)" },
});
