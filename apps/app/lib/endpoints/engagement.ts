import api from "@/lib/api";
import type { AppNotification, Address, Offer, Ad, Banner, District, Favorite } from "@/lib/types";

// Notifications
export interface NotificationsPage {
  items: AppNotification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}
export function getNotifications(page = 1, limit = 30) {
  return api.get<NotificationsPage>("/notifications", { params: { page, limit } }).then((r) => r.data);
}
export function markNotificationRead(id: string) {
  return api.patch(`/notifications/${id}/read`);
}
export function markAllNotificationsRead() {
  return api.patch("/notifications/read-all");
}
export function registerPushToken(token: string, platform: "ios" | "android") {
  return api.post("/notifications/push-token", { token, platform });
}
export function unregisterPushToken(token: string) {
  return api.delete("/notifications/push-token", { data: { token } });
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
// `home: true` → homepage "Today's Offers" (featured + admin-approved
// only). Omit it for the general "all offers" screen and store pages,
// which keep showing every active offer as before.
export function getOffers(opts?: { storeId?: string; home?: boolean }) {
  return api
    .get<Offer[]>("/offers", { params: { storeId: opts?.storeId, home: opts?.home ? "true" : undefined } })
    .then((r) => r.data);
}
export function getMyOffers(storeId?: string) {
  return api.get<Offer[]>("/offers/mine", { params: { storeId } }).then((r) => r.data);
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
export function toggleOfferActive(id: string) {
  return api.patch<Offer>(`/offers/${id}/toggle-active`);
}

// Ads & Banners — carousel content. GET is public and already filtered to
// "currently live" (active + inside any startsAt/endsAt window) by the API.
export function getAds(storeId?: string) {
  return api.get<Ad[]>("/ads", { params: { storeId } }).then((r) => r.data);
}
export function getMyAds(storeId?: string) {
  return api.get<Ad[]>("/ads/mine", { params: { storeId } }).then((r) => r.data);
}
export function createAd(payload: Partial<Ad>) {
  return api.post<Ad>("/ads", payload).then((r) => r.data);
}
export function updateAd(id: string, payload: Partial<Ad>) {
  return api.patch<Ad>(`/ads/${id}`, payload).then((r) => r.data);
}
export function deleteAd(id: string) {
  return api.delete(`/ads/${id}`);
}
export function toggleAdActive(id: string) {
  return api.patch<Ad>(`/ads/${id}/toggle-active`);
}

export function getBanners() {
  return api.get<Banner[]>("/banners").then((r) => r.data);
}
export function getAllBanners() {
  return api.get<Banner[]>("/banners/all").then((r) => r.data);
}
export function createBanner(payload: Partial<Banner>) {
  return api.post<Banner>("/banners", payload).then((r) => r.data);
}
export function updateBanner(id: string, payload: Partial<Banner>) {
  return api.patch<Banner>(`/banners/${id}`, payload).then((r) => r.data);
}
export function deleteBanner(id: string) {
  return api.delete(`/banners/${id}`);
}
export function toggleBannerActive(id: string) {
  return api.patch<Banner>(`/banners/${id}/toggle-active`);
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
  // Don't set Content-Type manually — axios needs to generate it itself
  // (including the multipart boundary) when the body is a FormData
  // instance. A hardcoded header here has no boundary, so the backend
  // can't parse the body and the upload fails with "No file provided".
  return api
    .post<{ url: string; path: string; bucket: string }>("/upload/image", form)
    .then((r) => r.data);
}
