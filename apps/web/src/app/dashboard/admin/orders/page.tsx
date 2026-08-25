'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Order, OrderStatus } from '@/types';

// Matches the labels already used in profile/orders/page.tsx and
// dashboard/store/orders/page.tsx — same statuses, same wording.
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'بانتظار تأكيد المتجر',
  ACCEPTED: 'تم تأكيد الطلب',
  PREPARING: 'جارِ التحضير',
  READY: 'جاهز للتوصيل',
  DELIVERING: 'في الطريق',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: 'bg-accent/10 text-accent-600',
  ACCEPTED: 'bg-primary-50 text-primary-700',
  PREPARING: 'bg-primary-50 text-primary-700',
  READY: 'bg-primary-50 text-primary-700',
  DELIVERING: 'bg-primary-50 text-primary-700',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-red-50 text-red-500',
};

function AdminOrders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['admin-orders', search, status],
    queryFn: () =>
      api.get('/orders', { params: { search: search || undefined, status: status || undefined } }).then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">الطلبات</h1>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 bg-white px-4 py-2.5 shadow-soft">
          <Search size={16} className="text-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعميل أو المتجر..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl2 bg-white px-4 py-2.5 text-sm shadow-soft outline-none"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 flex flex-col gap-2">
        {(orders ?? []).map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="min-w-0">
              <p className="font-mono text-xs text-ink/40">#{order.id.slice(0, 8)}</p>
              <h4 className="truncate font-bold text-ink">{order.store?.name ?? '—'}</h4>
              <p className="truncate text-xs text-ink/50">
                {order.user?.fullName ?? order.customerName} · {order.user?.phone ?? order.phone}
              </p>
            </div>
            <div className="text-left">
              <p className="font-mono text-sm font-bold text-ink">{order.total} ج.م</p>
              {order.commission != null && (
                <p className="text-[11px] text-ink/40">عمولة: {order.commission} ج.م</p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_TONE[order.orderStatus]}`}>
              {STATUS_LABELS[order.orderStatus]}
            </span>
          </div>
        ))}
        {!isLoading && orders?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لا توجد طلبات مطابقة</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminOrdersPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdminOrders />
    </RoleGate>
  );
}
