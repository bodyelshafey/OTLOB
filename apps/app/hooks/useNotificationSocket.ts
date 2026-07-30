import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/authStore";

/**
 * Push notifications: the API reference doesn't expose a device-token
 * registration endpoint, so per spec we do NOT invent one. Instead we rely
 * on this socket listener for in-app notification delivery. If/when the
 * backend adds something like POST /notifications/register-device, wire
 * Expo Notifications' push token into it here and this hook can stay as
 * the in-app fallback for when the app is foregrounded.
 */
export function useNotificationSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket();

    const onNotification = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("notification:new", onNotification);
    return () => {
      socket.off("notification:new", onNotification);
    };
  }, [accessToken, queryClient]);
}
