'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock3, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreOrderEvents } from '@/lib/socket';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Order, OrderStatus, Store } from '@/types';

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  PENDING: { next: 'ACCEPTED', label: 'قبول الطلب' },
  ACCEPTED: { next: 'PREPARING', label: 'بدء التحضير' },
  PREPARING: { next: 'READY', label: 'الطلب جاهز' },
  READY: { next: 'DELIVERING', label: 'خرج للتوصيل' },
  DELIVERING: { next: 'COMPLETED', label: 'تم التسليم' },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'جديد',
  ACCEPTED: 'مقبول',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز',
  DELIVERING: 'في التوصيل',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
};

function StatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={14} className="text-green-500" />;
  if (status === 'CANCELLED') return <XCircle size={14} className="text-red-500" />;
  if (status === 'DELIVERING') return <Truck size={14} className="text-primary-700" />;
  return <Clock3 size={14} className="text-accent" />;
}

function StoreOrdersManager() {
  const queryClient = useQueryClient();

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['store-orders', store?.id],
    queryFn: () => api.get(`/orders/store/${store!.id}`).then((r) => r.data),
    enabled: !!store,
    refetchInterval: 15_000, // fallback polling alongside the live socket push
  });

  const onLiveEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] });
  }, [queryClient, store?.id]);

  useStoreOrderEvents(store?.id, onLiveEvent);

  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] }),
  });

  const cancelOrder = useMutation({
    mutationFn: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'CANCELLED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] }),
  });

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">الطلبات</h1>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {(orders ?? []).map((order) => {
          const action = NEXT_STATUS[order.orderStatus];
          return (
            <div key={order.id} className="rounded-xl2 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">{order.customerName}</h3>
                <span className="flex items-center gap-1 text-xs font-bold text-ink/60">
                  <StatusBadge status={order.orderStatus} />
                  {STATUS_LABELS[order.orderStatus]}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/40" dir="ltr">
                {order.phone}
              </p>
              <p className="mt-1 text-xs text-ink/50">{order.fullAddress}</p>

              <div className="mt-2 flex flex-wrap gap-1">
                {order.items?.map((item) => (
                  <span key={item.id} className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-ink/60">
                    {item.productName} × {item.quantity}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-primary-50 pt-2">
                <span className="font-mono font-bold text-primary-700">{order.total} ج.م</span>
                <div className="flex gap-2">
                  {order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'COMPLETED' && (
                    <button
                      onClick={() => cancelOrder.mutate(order.id)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500"
                    >
                      إلغاء
                    </button>
                  )}
                  {action && (
                    <button
                      onClick={() => updateStatus.mutate({ orderId: order.id, status: action.next })}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {action.label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && orders?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 lg:col-span-2 xl:col-span-3">لا توجد طلبات بعد</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function StoreOrdersPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <StoreOrdersManager />
    </RoleGate>
  );
}
