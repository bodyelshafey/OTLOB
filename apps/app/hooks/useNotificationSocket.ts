import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/authStore";

/**
 * In-app live notification delivery via the realtime socket — refreshes
 * the notifications list the moment the backend emits one, so a customer
 * with the app open sees an order update without waiting for a push
 * notification (which only wakes a backgrounded/closed app). Push delivery
 * itself is handled separately by usePushNotifications.ts.
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
