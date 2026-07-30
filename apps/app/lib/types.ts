// These match the real API responses exactly, as confirmed against the
// working web app's source (web/src/types/index.ts) — several fields here
// differ from the original prompt's API reference (e.g. `image` not
// `imageUrl`, `orderStatus` not `status`), which is why the first pass
// didn't work end to end.

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: "USER" | "STORE_OWNER" | "EMPLOYEE" | "DRIVER" | "ADMIN" | "SUPER_ADMIN";
}

export interface StoreType {
  id: string;
  nameAr: string;
  nameEn: string;
  image?: string | null;
}

export interface Store {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  coverImage?: string | null;
  rating: number;
  deliveryTime?: string | null;
  deliveryFee: number;
  minimumOrder: number;
  isOpen: boolean;
  storeType?: StoreType;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  image?: string | null;
  storeTypeId: string;
  storeId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  isAvailable: boolean;
  storeId: string;
  categoryId: string;
}

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export interface Order {
  id: string;
  storeId: string;
  customerName: string;
  phone: string;
  fullAddress: string;
  orderStatus: OrderStatus;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  store?: Store;
  items?: Array<{
    id: string;
    productName: string;
    productImage?: string | null;
    quantity: number;
    price: number;
  }>;
}

export interface Address {
  id: string;
  fullAddress: string;
  districtId?: string;
  district?: { id: string; nameAr: string; nameEn?: string };
}

export interface District {
  id: string;
  nameAr: string;
  nameEn?: string;
}

export interface Offer {
  id: string;
  titleAr: string;
  titleEn?: string;
  oldPrice?: number | null;
  newPrice?: number | null;
  discountPercentage?: number | null;
  storeId?: string;
}

export interface Favorite {
  id: string;
  store?: Store | null;
  product?: Product | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// Generic paginated wrapper — /stores and /products respond this way.
export interface Paginated<T> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
}
