import api from "@/lib/api";
import type { Order } from "@/lib/types";

export function registerDriver(payload: Record<string, unknown>) {
  return api.post("/drivers/register", payload).then((r) => r.data);
}

export function setDriverStatus(status: "OFFLINE" | "AVAILABLE") {
  return api.patch("/drivers/status", { status }).then((r) => r.data);
}

export function updateDriverLocation(lat: number, lng: number) {
  return api.patch("/drivers/location", { lat, lng }).then((r) => r.data);
}

export function getAvailableOrders() {
  return api.get<Order[]>("/drivers/available-orders").then((r) => r.data);
}

export function acceptOrder(orderId: string) {
  return api.post<Order>(`/drivers/orders/${orderId}/accept`).then((r) => r.data);
}

export function getMyDeliveries() {
  return api.get<Order[]>("/drivers/my-deliveries").then((r) => r.data);
}
