'use client';

import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';

let socket: Socket | null = null;

function getSocket(token: string) {
  if (socket && socket.connected) return socket;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  const baseUrl = apiUrl.replace(/\/api\/?$/, '');
  socket = io(`${baseUrl}/realtime`, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

/**
 * Subscribes to live status + driver-location updates for a single order.
 * Falls back gracefully to whatever was fetched over REST if the socket
 * never connects (e.g. realtime disabled or blocked network).
 */
export function useOrderTracking(orderId: string | undefined) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId || !accessToken) return;

    const s = getSocket(accessToken);
    socketRef.current = s;

    const onStatus = (payload: { orderId: string; status: string }) => {
      if (payload.orderId === orderId) setStatus(payload.status);
    };
    const onLocation = (payload: { orderId: string; lat: number; lng: number }) => {
      if (payload.orderId === orderId) setDriverLocation({ lat: payload.lat, lng: payload.lng });
    };

    s.emit('order:subscribe', { orderId });
    s.on('order:status', onStatus);
    s.on('driver:location', onLocation);

    return () => {
      s.emit('order:unsubscribe', { orderId });
      s.off('order:status', onStatus);
      s.off('driver:location', onLocation);
    };
  }, [orderId, accessToken]);

  return { status, driverLocation };
}

/** Subscribes to the current user's personal notification stream. */
export function useLiveNotifications(onNotification: (n: unknown) => void) {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const s = getSocket(accessToken);
    s.on('notification:new', onNotification);
    return () => {
      s.off('notification:new', onNotification);
    };
  }, [accessToken, onNotification]);
}

/**
 * Store-dashboard hook: subscribes to the store's room for new-order alerts
 * and status pushes, so the orders list stays live without polling alone.
 */
export function useStoreOrderEvents(storeId: string | undefined, onEvent: () => void) {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!storeId || !accessToken) return;
    const s = getSocket(accessToken);
    s.emit('store:subscribe', { storeId });
    s.on('order:new', onEvent);
    s.on('order:status', onEvent);
    return () => {
      s.off('order:new', onEvent);
      s.off('order:status', onEvent);
    };
  }, [storeId, accessToken, onEvent]);
}

/**
 * Live status updates for ALL of the current user's orders at once — every
 * status change is also broadcast to the user's personal room server-side,
 * so no per-order subscription is needed for a list view like "My Orders".
 */
export function useLiveOrderStatuses() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) return;
    const s = getSocket(accessToken);
    const onStatus = (payload: { orderId: string; status: string }) => {
      setStatuses((prev) => ({ ...prev, [payload.orderId]: payload.status }));
    };
    s.on('order:status', onStatus);
    return () => {
      s.off('order:status', onStatus);
    };
  }, [accessToken]);

  return statuses;
}
