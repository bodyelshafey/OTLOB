import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as orders from "@/lib/endpoints/orders";
import { getSocket, subscribeToOrder, unsubscribeFromOrder } from "@/lib/socket";
import type { OrderStatus, Order } from "@/lib/types";

export function useMyOrders() {
  return useQuery({ queryKey: ["orders", "me"], queryFn: orders.getMyOrders });
}

export function useOrder(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["order", id],
    queryFn: () => orders.getOrder(id as string),
    enabled: !!id,
  });

  // Live status updates over the socket, falling back to the fetched value.
  useEffect(() => {
    if (!id) return;
    subscribeToOrder(id);
    const socket = getSocket();

    const onStatus = (payload: { orderId: string; status: OrderStatus }) => {
      if (payload.orderId !== id) return;
      queryClient.setQueryData<Order | undefined>(["order", id], (old) =>
        old ? { ...old, orderStatus: payload.status } : old
      );
    };

    socket.on("order:status", onStatus);
    return () => {
      socket.off("order:status", onStatus);
      unsubscribeFromOrder(id);
    };
  }, [id, queryClient]);

  return query;
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orders.syncCartAndPlaceOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "me"] });
    },
  });
}
