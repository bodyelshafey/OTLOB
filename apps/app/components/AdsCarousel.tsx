import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet, Dimensions, Linking } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts, radii, spacing, shadow } from "@/theme";
import type { Ad, Banner } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Peek layout: the active card doesn't fill the screen, so the previous/next
// cards are partially visible on either side — matches the web version's
// carousel and the reference image ("current ad centered, neighbors peeking").
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_GAP = spacing(3);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const SIDE_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const CARD_HEIGHT = CARD_WIDTH * (9 / 16);

type CarouselItem = (Ad | Banner) & {
  id: string;
  image?: string | null;
  title?: string | null;
  link?: string | null;
  store?: { id: string; name: string } | null;
};

interface Props {
  items: CarouselItem[];
  // Auto-slide interval in ms. Pass 0 to disable auto-slide entirely.
  autoSlideMs?: number;
}

// Plain FlatList + a timer — deliberately avoids pulling in a carousel
// library (e.g. reanimated-carousel) since none is installed yet and this
// doesn't need gestures beyond what FlatList already gives for free
// (paging swipe). Keeps the native dependency surface unchanged.
export function AdsCarousel({ items, autoSlideMs = 4000 }: Props) {
  const router = useRouter();
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoSlideMs || items.length <= 1) return;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const next = (indexRef.current + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: next * SNAP_INTERVAL, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, autoSlideMs);
    return () => clearInterval(timer);
  }, [autoSlideMs, items.length]);

  const pauseThenResume = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    // Resume auto-rotation a couple seconds after the user stops touching
    // the carousel — long enough that a drag/swipe doesn't immediately
    // fight with the next auto-advance.
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 3000);
  }, []);

  const onMomentumEnd = useCallback((e: any) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    indexRef.current = next;
    setIndex(next);
  }, []);

  const handlePress = useCallback(
    (item: CarouselItem) => {
      if (item.link) {
        if (/^https?:\/\//.test(item.link)) {
          Linking.openURL(item.link).catch(() => {});
          return;
        }
        // Only ever push a link that's actually a relative in-app route —
        // the DTO rejects javascript:/data: links server-side, but this is
        // a second line of defense against anything written directly.
        if (item.link.startsWith('/')) {
          router.push(item.link as any);
        }
        return;
      }
      const storeId = (item as Ad).storeId ?? item.store?.id;
      if (storeId) router.push(`/store/${storeId}`);
    },
    [router]
  );

  if (items.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing(6) }}>
      <FlatList
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        onScrollBeginDrag={pauseThenResume}
        onTouchStart={pauseThenResume}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.92 }]}
            onPress={() => handlePress(item)}
          >
            {item.image ? (
              // resizeMode="contain" — never stretch/crop the actual
              // uploaded ad image, letterbox instead if its ratio differs.
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.image, { backgroundColor: colors.primary100 }]} />
            )}
            {!!item.store?.name && (
              <View style={styles.storeBadge}>
                <Text style={styles.storeBadgeText} numberOfLines={1}>
                  {item.store.name}
                </Text>
              </View>
            )}
            {!!item.title && (
              <View style={styles.titleWrap}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View key={item.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.primary100,
    marginEnd: CARD_GAP,
  },
  image: { width: "100%", height: "100%" },
  storeBadge: {
    position: "absolute",
    top: 8,
    end: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "70%",
  },
  storeBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.primary },
  titleWrap: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    padding: 12,
    backgroundColor: "rgba(11,37,48,0.45)",
  },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 16 },
});
