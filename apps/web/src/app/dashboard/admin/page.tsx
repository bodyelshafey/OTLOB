'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Store, ShoppingCart, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';

function AdminOverview() {
  const { data: summary } = useQuery({
    queryKey: ['platform-summary'],
    queryFn: () => api.get('/reports/platform').then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">لوحة تحكم المنصة</h1>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="عدد المستخدمين" value={summary?.usersCount ?? 0} icon={Users} />
        <StatCard label="عدد المتاجر" value={summary?.storesCount ?? 0} icon={Store} />
        <StatCard label="إجمالي الطلبات" value={summary?.ordersCount ?? 0} icon={ShoppingCart} />
        <StatCard
          label="عمولة المنصة"
          value={`${summary?.totalCommissionEarned ?? 0} ج.م`}
          icon={Wallet}
          tone="accent"
        />
      </div>

      <div className="mt-3 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md">
        <div className="flex justify-between text-sm">
          <span className="text-ink/60">إجمالي قيمة الطلبات (GMV)</span>
          <span className="font-mono font-bold text-primary-700">{summary?.totalGMV ?? 0} ج.م</span>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdminOverview />
    </RoleGate>
  );
}
