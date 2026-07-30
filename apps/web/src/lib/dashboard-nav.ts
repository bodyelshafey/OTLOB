import { LayoutDashboard, Package, Tag, ShoppingCart, Users, Truck, Store, Ticket, Compass } from 'lucide-react';

export const STORE_TABS = [
  { href: '/dashboard/store', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/dashboard/store/products', label: 'المنتجات', icon: Package },
  { href: '/dashboard/store/offers', label: 'العروض', icon: Tag },
  { href: '/dashboard/store/orders', label: 'الطلبات', icon: ShoppingCart },
  { href: '/dashboard/store/employees', label: 'الموظفين', icon: Users },
];

export const DRIVER_TABS = [
  { href: '/dashboard/driver', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/dashboard/driver/available', label: 'طلبات متاحة', icon: Compass },
  { href: '/dashboard/driver/deliveries', label: 'توصيلاتي', icon: Truck },
];

export const ADMIN_TABS = [
  { href: '/dashboard/admin', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/dashboard/admin/stores', label: 'المتاجر', icon: Store },
  { href: '/dashboard/admin/store-types', label: 'أنواع المتاجر', icon: Tag },
  { href: '/dashboard/admin/users', label: 'المستخدمين', icon: Users },
  { href: '/dashboard/admin/coupons', label: 'الكوبونات', icon: Ticket },
];
