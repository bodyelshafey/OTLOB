'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, ShoppingCart, Star, Wallet, Power } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store } from '@/types';

function StoreOverview() {
  const queryClient = useQueryClient();

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: summary } = useQuery({
    queryKey: ['store-summary', store?.id],
    queryFn: () => api.get(`/reports/store/${store!.id}`).then((r) => r.data),
    enabled: !!store,
  });

  const toggleOpen = useMutation({
    mutationFn: () => api.patch(`/stores/${store!.id}/toggle-open`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-store'] }),
  });

  if (!stores) return <p className="px-4 py-10 text-center text-sm text-ink/40">جارِ التحميل...</p>;

  if (!store) {
    return (
      <p className="px-4 py-10 text-center text-sm text-ink/40">
        لا يوجد متجر مرتبط بحسابك بعد. تواصل مع الدعم لإضافة متجرك.
      </p>
    );
  }

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
        <div>
          <h1 className="font-display font-bold text-ink">{store.name}</h1>
          <p className="text-xs text-ink/50">{store.isOpen ? 'المتجر مفتوح حاليًا' : 'المتجر مغلق حاليًا'}</p>
        </div>
        <button
          onClick={() => toggleOpen.mutate()}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${
            store.isOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}
        >
          <Power size={14} />
          {store.isOpen ? 'إغلاق المتجر' : 'فتح المتجر'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="طلبات مكتملة" value={summary?.ordersCompleted ?? 0} icon={ShoppingCart} />
        <StatCard
          label="إجمالي الإيرادات"
          value={`${summary?.totalRevenue ?? 0} ج.م`}
          icon={Wallet}
          tone="accent"
        />
        <StatCard
          label="متوسط التقييم"
          value={Number(summary?.averageRating ?? 0).toFixed(1)}
          icon={Star}
        />
        <StatCard label="عدد التقييمات" value={summary?.reviewsCount ?? 0} icon={Package} />
      </div>
    </DashboardShell>
  );
}

export default function StoreDashboardPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <StoreOverview />
    </RoleGate>
  );
}
