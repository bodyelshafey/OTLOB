import "react-native-gesture-handler";

import { useEffect, useState, useCallback } from "react";
import { I18nManager, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Header } from "@/components/Header";
import {
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from "@expo-google-fonts/cairo";

import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
} from "@expo-google-fonts/tajawal";

import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { i18n, isRTL } from "@/i18n";
import { OfflineBanner } from "@/components/Feedback";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { usePushNotifications } from "@/hooks/usePushNotifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnReconnect: true },
  },
});

export default function RootLayout() {

  const [fontsLoaded] = useFonts({
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    cyberjunkies: require("../assets/fonts/Cyberjunkies.ttf"),
  });

  const locale = useSettingsStore((s) => s.locale);
  const [rtlReady, setRtlReady] = useState(false);

  // I18nManager.forceRTL only takes visual effect after the next full app
  // launch (a native RN constraint, not something JS can force mid-session).
  // We set the flag here so it's correct on the *next* cold start; the
  // language-toggle screen (app/(tabs)/profile/language.tsx) tells the user
  // to restart the app after switching.
  useEffect(() => {
    const shouldBeRTL = isRTL(locale);
    i18n.locale = locale;
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(shouldBeRTL);
    }
    setRtlReady(true);
  }, [locale]);

  const onLayout = useCallback(async () => {
    if (fontsLoaded && rtlReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, rtlReady]);

  console.log("fontsLoaded:", fontsLoaded);
console.log("rtlReady:", rtlReady);

if (!fontsLoaded || !rtlReady) {
  return (
    <View style={{ flex: 1, backgroundColor: "white" }} />
  );
}

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Redirects unauthenticated users to the auth stack and authenticated
 * users away from it, mirroring the web app's route-guarding logic.
 */
// app/_layout.tsx — داخل AuthGate (الكومبوننت اللي يتحكم بالتوجيه حسب حالة الدخول)

function AuthGate() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const segments = useSegments();
  const router = useRouter();
  const online = useIsOnline();
  useNotificationSocket();
  usePushNotifications();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    if (!accessToken && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
    } else if (accessToken && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [accessToken, segments, router]);

  const inAuthGroup = segments[0] === "(auth)";

  return (
    <View style={{ flex: 1 }}>
      {!inAuthGroup && <Header />}
      <OfflineBanner visible={!online} />
      <Slot />
    </View>
  );
}