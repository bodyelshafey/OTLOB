'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DRIVER_TABS } from '@/lib/dashboard-nav';

const STATUS_LABELS: Record<string, string> = {
  DELIVERING: 'جارِ التوصيل',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

function DeliveriesHistory() {
  const { data: deliveries, isLoading } = useQuery<any[]>({
    queryKey: ['my-deliveries'],
    queryFn: () => api.get('/drivers/my-deliveries').then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة السائق" tabs={DRIVER_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">توصيلاتي</h1>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(deliveries ?? []).map((order) => (
            <div key={order.id} className="rounded-xl2 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">{order.fullAddress}</h3>
                <span className="flex items-center gap-1 text-xs font-bold text-ink/60">
                  {order.orderStatus === 'COMPLETED' ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : order.orderStatus === 'DELIVERING' ? (
                    <Truck size={14} className="text-primary-700" />
                  ) : (
                    <Clock3 size={14} className="text-accent" />
                  )}
                  {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-primary-50 pt-2 text-sm">
                <span className="text-ink/60">رسوم التوصيل</span>
                <span className="font-mono font-bold text-primary-700">{order.deliveryFee} ج.م</span>
              </div>
            </div>
          ))}
        {!isLoading && deliveries?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لسه معملتش أي توصيلة</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function DriverDeliveriesPage() {
  return (
    <RoleGate allow={['DRIVER', 'ADMIN', 'SUPER_ADMIN']}>
      <DeliveriesHistory />
    </RoleGate>
  );
}
