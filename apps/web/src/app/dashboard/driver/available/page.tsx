'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DRIVER_TABS } from '@/lib/dashboard-nav';

function AvailableOrders() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ['available-orders'],
    queryFn: () => api.get('/drivers/available-orders').then((r) => r.data),
    refetchInterval: 10_000,
  });

  const acceptOrder = useMutation({
    mutationFn: (orderId: string) => api.post(`/drivers/orders/${orderId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
  });

  return (
    <DashboardShell title="لوحة السائق" tabs={DRIVER_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">طلبات متاحة الآن</h1>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ البحث عن طلبات...</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="rounded-xl2 bg-white p-4 shadow-soft">
              <h3 className="font-bold text-ink">{order.store?.name}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink/50">
                <MapPin size={13} />
                {order.fullAddress}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-primary-50 pt-2">
                <span className="flex items-center gap-1 font-mono font-bold text-primary-700">
                  <Wallet size={14} />
                  {order.deliveryFee} ج.م
                </span>
                <button
                  onClick={() => acceptOrder.mutate(order.id)}
                  disabled={acceptOrder.isPending}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  قبول التوصيلة
                </button>
              </div>
            </div>
          ))}
        {!isLoading && orders?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">
            لا توجد طلبات متاحة حاليًا، جرّب تاني بعد شوية
          </p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function DriverAvailablePage() {
  return (
    <RoleGate allow={['DRIVER', 'ADMIN', 'SUPER_ADMIN']}>
      <AvailableOrders />
    </RoleGate>
  );
}
