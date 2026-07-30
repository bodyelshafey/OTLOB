export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: 'USER' | 'STORE_OWNER' | 'EMPLOYEE' | 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN';
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

export interface CartItem {
  id: string;
  productId?: string | null;
  offerId?: string | null;
  quantity: number;
  note?: string | null;
  product?: Product | null;
}

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED';

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
