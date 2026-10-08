'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreOrderEvents } from '@/lib/socket';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CASHIER_TABS } from '@/lib/dashboard-nav';
import type { Order, OrderStatus, Store } from '@/types';

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  PENDING: { next: 'ACCEPTED', label: 'قبول الطلب' },
  ACCEPTED: { next: 'PREPARING', label: 'بدء التحضير' },
  PREPARING: { next: 'READY', label: 'الطلب جاهز' },
  READY: { next: 'DELIVERING', label: 'خرج للتوصيل' },
  DELIVERING: { next: 'COMPLETED', label: 'تم التسليم' },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'جديد', ACCEPTED: 'مقبول', PREPARING: 'قيد التحضير',
  READY: 'جاهز', DELIVERING: 'في التوصيل', COMPLETED: 'مكتمل', CANCELLED: 'ملغي',
};

type TabKey = 'new' | 'active' | 'completed' | 'problem';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'new', label: 'طلبات جديدة' },
  { key: 'active', label: 'قيد التنفيذ' },
  { key: 'completed', label: 'مكتملة' },
  { key: 'problem', label: 'فيها مشكلة' },
];

// Cashier dashboard (Phase 6/7, 2026-09-13) — order management ONLY, no
// products/offers/settings access (that's `/dashboard/store`, STORE_OWNER
// only — see RoleGate). Backed by the same already-correctly-scoped
// GET /orders/store/:storeId and PATCH /orders/:id/status endpoints the
// owner's orders page uses (both already accept EMPLOYEE — see
// OrdersService.assertStoreAccess on the backend), plus the new
// report/resolve-issue endpoints for the "Problem" action.
function CashierOrdersManager() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('new');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [issueReason, setIssueReason] = useState('');

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['store-orders', store?.id],
    queryFn: () => api.get(`/orders/store/${store!.id}`).then((r) => r.data),
    enabled: !!store,
  });

  useStoreOrderEvents(store?.id, () => queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] }));

  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] }),
  });

  const reportIssue = useMutation({
    mutationFn: () => api.post(`/orders/${reportingId}/issue`, { reason: issueReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] });
      setReportingId(null);
      setIssueReason('');
    },
  });

  const resolveIssue = useMutation({
    mutationFn: (orderId: string) => api.post(`/orders/${orderId}/issue/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-orders', store?.id] }),
  });

  if (!store) return null;

  const filtered = (orders ?? []).filter((o) => {
    if (tab === 'problem') return o.hasIssue;
    if (tab === 'new') return ['PENDING', 'ACCEPTED', 'PREPARING'].includes(o.orderStatus);
    if (tab === 'active') return ['READY', 'DELIVERING'].includes(o.orderStatus);
    return o.orderStatus === 'COMPLETED';
  });

  return (
    <DashboardShell title="لوحة الكاشير" tabs={CASHIER_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">إدارة الطلبات</h1>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${
              tab === t.key ? 'bg-primary text-white' : 'bg-white text-ink/50 shadow-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((order) => {
          const action = NEXT_STATUS[order.orderStatus];
          return (
            <div
              key={order.id}
              className={`rounded-xl2 bg-white p-4 shadow-soft ${order.hasIssue ? 'ring-2 ring-red-400' : ''}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">{order.customerName}</h3>
                <span className="text-xs font-bold text-ink/60">{STATUS_LABELS[order.orderStatus]}</span>
              </div>
              <p className="mt-1 text-xs text-ink/40" dir="ltr">
                {order.phone}
              </p>
              <p className="mt-1 text-xs text-ink/50">{order.fullAddress}</p>

              {order.hasIssue && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{order.issueReason}</span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {order.items?.map((item) => (
                  <span key={item.id} className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-ink/60">
                    {item.productName} × {item.quantity}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-primary-50 pt-2">
                <span className="font-mono font-bold text-primary-700">{order.total} ج.م</span>
                <div className="flex flex-wrap gap-2">
                  {order.hasIssue ? (
                    <button
                      onClick={() => resolveIssue.mutate(order.id)}
                      className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-600"
                    >
                      تم حل المشكلة
                    </button>
                  ) : (
                    order.orderStatus !== 'COMPLETED' &&
                    order.orderStatus !== 'CANCELLED' && (
                      <button
                        onClick={() => setReportingId(order.id)}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500"
                      >
                        الإبلاغ عن مشكلة
                      </button>
                    )
                  )}
                  {action && !order.hasIssue && (
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
        {!isLoading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 lg:col-span-2 xl:col-span-3">لا توجد طلبات هنا</p>
        )}
      </div>

      {reportingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-card">
            <h3 className="font-bold text-ink">الإبلاغ عن مشكلة</h3>
            <textarea
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
              placeholder="اكتب المشكلة..."
              rows={3}
              className="mt-3 w-full rounded-xl2 bg-primary-50 p-3 text-sm outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setReportingId(null);
                  setIssueReason('');
                }}
                className="flex-1 rounded-full bg-ink/5 py-2 text-sm font-bold text-ink/60"
              >
                إلغاء
              </button>
              <button
                onClick={() => reportIssue.mutate()}
                disabled={!issueReason.trim() || reportIssue.isPending}
                className="flex-1 rounded-full bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {reportIssue.isPending ? 'جارِ الإرسال...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function CashierDashboardPage() {
  return (
    <RoleGate allow={['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}>
      <CashierOrdersManager />
    </RoleGate>
  );
}
