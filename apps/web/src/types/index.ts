export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: 'USER' | 'STORE_OWNER' | 'EMPLOYEE' | 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN';
  isVerified?: boolean;
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
  // Only present on GET /stores/:id — combines isOpen with the configured
  // weekly schedule (absent = not restricted by hours, only isOpen matters).
  isOpenNow?: boolean;
  storeType?: StoreType;
}

export interface WorkingHour {
  id?: string;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  isClosed: boolean;
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

export interface Offer {
  id: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  image?: string | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  discountPercentage?: number | null;
  isActive?: boolean;
  storeId?: string;
  // Set by the store owner to request homepage "Today's Offers" placement.
  // Doesn't guarantee placement by itself — see approvalStatus.
  isFeaturedHome?: boolean;
  displayOrder?: number;
  // Only meaningful when isFeaturedHome is true. Server-controlled — never
  // send this on create/update, it's ignored if you do.
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  // Fully optional "detailed offer" info.
  includedItems?: string | null;
  conditions?: string | null;
  quantityLimit?: number | null;
  // Present on GET /offers and GET /offers/:id — omitted on write payloads.
  store?: {
    id: string;
    name: string;
    image?: string | null;
    deliveryTime?: string | null;
    rating?: number;
    isOpen?: boolean;
  } | null;
}

export interface Ad {
  id: string;
  title?: string | null;
  image?: string | null;
  link?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  storeId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  // Server-controlled — never send this on create/update, it's ignored.
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  store?: { id: string; name: string; image?: string | null } | null;
}

export interface Banner {
  id: string;
  title?: string | null;
  image: string;
  link?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  // Optional — the store this banner is promoting, set from the admin
  // dashboard. Present on GET responses only; send storeId (not this) on writes.
  storeId?: string | null;
  store?: { id: string; name: string } | null;
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
  commission?: number;
  total: number;
  createdAt: string;
  store?: Store;
  user?: { fullName?: string; phone?: string } | null;
  items?: Array<{
    id: string;
    productName: string;
    productImage?: string | null;
    quantity: number;
    price: number;
  }>;
}
