import api from "@/lib/api";
import type { AppNotification, Address, Offer, District, Favorite } from "@/lib/types";

// Notifications
export function getNotifications() {
  return api.get<AppNotification[]>("/notifications").then((r) => r.data);
}
export function markNotificationRead(id: string) {
  return api.patch(`/notifications/${id}/read`);
}
export function markAllNotificationsRead() {
  return api.patch("/notifications/read-all");
}

// Addresses — real payload is { districtId, fullAddress }, no separate
// "details"/"label"/"zoneId" fields.
export function getAddresses() {
  return api.get<Address[]>("/addresses").then((r) => r.data);
}
export function createAddress(payload: { districtId: string; fullAddress: string }) {
  return api.post<Address>("/addresses", payload).then((r) => r.data);
}
export function updateAddress(id: string, payload: Partial<{ districtId: string; fullAddress: string }>) {
  return api.patch<Address>(`/addresses/${id}`, payload).then((r) => r.data);
}
export function deleteAddress(id: string) {
  return api.delete(`/addresses/${id}`);
}

// Favorites — each record embeds either `store` or `product`.
export function getFavorites() {
  return api.get<Favorite[]>("/favorites").then((r) => r.data);
}
export function addFavorite(payload: { storeId?: string; productId?: string }) {
  return api.post<Favorite>("/favorites", payload).then((r) => r.data);
}
export function removeFavorite(id: string) {
  return api.delete(`/favorites/${id}`);
}

// Reviews
export function getStoreReviews(storeId: string) {
  return api.get(`/reviews/store/${storeId}`).then((r) => r.data);
}
export function createReview(payload: {
  storeId: string;
  orderId: string;
  rating: number;
  comment?: string;
}) {
  return api.post("/reviews", payload).then((r) => r.data);
}

// Offers — bare array, titleAr/titleEn + discountPercentage/oldPrice/newPrice
export function getOffers(storeId?: string) {
  return api.get<Offer[]>("/offers", { params: { storeId } }).then((r) => r.data);
}
export function getOffer(id: string) {
  return api.get<Offer>(`/offers/${id}`).then((r) => r.data);
}
export function createOffer(payload: Partial<Offer>) {
  return api.post<Offer>("/offers", payload).then((r) => r.data);
}
export function updateOffer(id: string, payload: Partial<Offer>) {
  return api.patch<Offer>(`/offers/${id}`, payload).then((r) => r.data);
}
export function deleteOffer(id: string) {
  return api.delete(`/offers/${id}`);
}

// Coupons
export function validateCoupon(code: string) {
  return api.get(`/coupons/validate/${code}`).then((r) => r.data);
}
export function createCoupon(payload: Record<string, unknown>) {
  return api.post("/coupons", payload).then((r) => r.data);
}
export function deleteCoupon(id: string) {
  return api.delete(`/coupons/${id}`);
}

// Location
export function getDistricts() {
  return api
    .get<District[]>("/districts")
    .then((r) => r.data)
    .catch(() => [] as District[]);
}

// Upload — pass a React Native file object: { uri, name, type }
export function uploadImage(
  file: { uri: string; name: string; type: string },
  bucket: "avatars" | "products" | "offers" | "stores" = "products"
) {
  const form = new FormData();
  // @ts-expect-error RN FormData file shape differs from the DOM lib types
  form.append("file", file);
  form.append("bucket", bucket);
  return api
    .post<{ url: string; path: string; bucket: string }>("/upload/image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
}
