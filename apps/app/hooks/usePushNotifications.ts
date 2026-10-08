import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { registerPushToken, unregisterPushToken } from "@/lib/endpoints/engagement";

// Foreground notifications should still show a banner/sound instead of
// silently landing only in the notifications list — otherwise an order
// update while the app is open would be invisible until the user happens
// to open the notifications screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensurePermissionAndGetToken(): Promise<string | null> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  // Only ever prompt when the user hasn't made a decision yet — if they
  // already denied it (this session or a previous one), requesting again
  // would either silently no-op or, worse, feel like nagging. Respecting
  // "denied" here is the platform-correct behavior on both iOS and Android.
  if (status === "undetermined") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

// Registers (or unregisters, on logout) this device's push token with the
// backend, and routes a tapped notification to the relevant screen using
// the same `data` payload the backend attached when it queued the
// notification (see notification-targeting / orders.service.ts).
export function usePushNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const currentToken = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    ensurePermissionAndGetToken().then((token) => {
      if (cancelled || !token) return;
      currentToken.current = token;
      registerPushToken(token, Platform.OS === "ios" ? "ios" : "android").catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken && currentToken.current) {
      unregisterPushToken(currentToken.current).catch(() => {});
      currentToken.current = null;
    }
  }, [accessToken]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.orderId) {
        router.push(`/order/${data.orderId}`);
      } else if (data?.storeId) {
        router.push(`/store/${data.storeId}`);
      } else {
        router.push("/notifications");
      }
    });
    return () => subscription.remove();
  }, [router]);
}
