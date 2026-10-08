import api from "@/lib/api";
import type { Order } from "@/lib/types";

// NOTE: there used to be a registerDriver() calling POST /drivers/register
// here — that endpoint let ANY authenticated user create their own Driver
// profile with no role check at all (fixed 2026-09-12, see
// UsersService.promoteToDriver on the backend). The only way to become a
// DRIVER now is an admin action; a driver can only update their own
// already-existing profile via updateMyDriverProfile below. This function
// was never actually called anywhere in the app (driver onboarding is
// still a stub), so nothing else needed to change here.
export function updateMyDriverProfile(payload: { vehicleType?: string; plateNumber?: string }) {
  return api.patch("/drivers/me", payload).then((r) => r.data);
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
