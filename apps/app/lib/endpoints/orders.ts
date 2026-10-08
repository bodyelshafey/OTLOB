import api from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import type { LocalCartLine } from "@/store/cartStore";

// The backend keeps its own server-side cart. The web app's checkout syncs
// the local cart into it (clear, then re-add each line) immediately before
// submitting — mirror that exactly rather than trying to keep local and
// server cart in sync throughout the session.
export async function syncCartAndPlaceOrder(payload: {
  storeId: string;
  lines: LocalCartLine[];
  customerName: string;
  phone: string;
  fullAddress: string;
  paymentMethod: "CASH" | "CARD";
}) {
  await api.delete("/cart");
  for (const line of payload.lines) {
    if (line.offer) {
      await api.post("/cart", { offerId: line.offer.id, quantity: line.quantity });
    } else if (line.product) {
      await api.post("/cart", { productId: line.product.id, quantity: line.quantity });
    }
  }
  const { data } = await api.post<Order>("/orders", {
    storeId: payload.storeId,
    customerName: payload.customerName,
    phone: payload.phone,
    fullAddress: payload.fullAddress,
    paymentMethod: payload.paymentMethod,
  });
  return data;
}

export function getStoreOrders(storeId: string) {
  return api.get<Order[]>(`/orders/store/${storeId}`).then((r) => r.data);
}

export function getAllOrdersAdmin(params?: { status?: string; search?: string }) {
  return api.get<Order[]>("/orders", { params }).then((r) => r.data);
}

export function getMyOrders() {
  return api.get<Order[]>("/orders/me").then((r) => r.data);
}

export function getOrder(id: string) {
  return api.get<Order>(`/orders/${id}`).then((r) => r.data);
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  return api.patch<Order>(`/orders/${id}/status`, { status }).then((r) => r.data);
}
