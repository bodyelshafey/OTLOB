'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, Truck, Wallet, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DRIVER_TABS } from '@/lib/dashboard-nav';

const STATUS_LABELS: Record<string, string> = {
  OFFLINE: 'غير متصل',
  AVAILABLE: 'متاح لاستلام طلبات',
  ON_DELIVERY: 'في توصيلة حالية',
};

function DriverOverview() {
  const queryClient = useQueryClient();

  const { data: myProfile } = useQuery<{ status: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY' }>({
    queryKey: ['my-driver-profile'],
    queryFn: () => api.get('/drivers/me').then((r) => r.data),
  });

  const { data: deliveries } = useQuery<any[]>({
    queryKey: ['my-deliveries'],
    queryFn: () => api.get('/drivers/my-deliveries').then((r) => r.data),
  });

  const completed = (deliveries ?? []).filter((o) => o.orderStatus === 'COMPLETED');
  const active = (deliveries ?? []).find((o) => o.orderStatus === 'DELIVERING');
  const earnings = completed.reduce((sum, o) => sum + Number(o.deliveryFee ?? 0), 0);

  // Hydrated from the real server-side status on load (fixed 2026-09-13 —
  // this used to hardcode 'OFFLINE' on every page load regardless of the
  // driver's actual status). `active` (an in-flight DELIVERING order)
  // still takes priority in the label shown below, same as before.
  const status = myProfile?.status ?? 'OFFLINE';

  const setDriverStatus = useMutation({
    mutationFn: (s: string) => api.patch('/drivers/status', { status: s }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-driver-profile'] }),
  });

  return (
    <DashboardShell title="لوحة السائق" tabs={DRIVER_TABS}>
      <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
          <div>
            <h1 className="font-display font-bold text-ink">حالتك الآن</h1>
            <p className="text-xs text-ink/50">{active ? STATUS_LABELS.ON_DELIVERY : STATUS_LABELS[status]}</p>
          </div>
          {!active && (
            <button
              onClick={() => setDriverStatus.mutate(status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${
                status === 'AVAILABLE' ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink/50'
              }`}
            >
              <Power size={14} />
              {status === 'AVAILABLE' ? 'إنهاء العمل' : 'بدء العمل'}
            </button>
          )}
        </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:max-w-lg">
        <StatCard label="توصيلات مكتملة" value={completed.length} icon={Package} />
        <StatCard label="إجمالي الأرباح" value={`${earnings} ج.م`} icon={Wallet} tone="accent" />
      </div>

      {active && (
        <div className="mt-3 rounded-xl2 bg-primary-50 p-4 lg:max-w-lg">
          <p className="flex items-center gap-2 text-sm font-bold text-primary-700">
            <Truck size={16} />
            عندك توصيلة شغالة دلوقتي
          </p>
          <p className="mt-1 text-xs text-ink/60">{active.fullAddress}</p>
        </div>
      )}
    </DashboardShell>
  );
}

export default function DriverDashboardPage() {
  return (
    <RoleGate allow={['DRIVER', 'ADMIN', 'SUPER_ADMIN']}>
      <DriverOverview />
    </RoleGate>
  );
}
