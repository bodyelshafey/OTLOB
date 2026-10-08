'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet, ShoppingCart, Store as StoreIcon, Banknote } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';

interface PlatformSummary {
  usersCount: number;
  storesCount: number;
  ordersCount: number;
  totalGMV: number;
  totalCommissionEarned: number;
}

interface StoreCommissionRow {
  storeId: string;
  storeName: string;
  commissionPercentage: number;
  ordersCompleted: number;
  totalRevenue: number;
  totalCommission: number;
}

function AdminCommission() {
  const { data: summary } = useQuery<PlatformSummary>({
    queryKey: ['platform-summary'],
    queryFn: () => api.get('/reports/platform').then((r) => r.data),
  });

  const { data: byStore, isLoading } = useQuery<StoreCommissionRow[]>({
    queryKey: ['platform-commission-by-store'],
    queryFn: () => api.get('/reports/platform/by-store').then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">العمولة والإيرادات</h1>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي قيمة الطلبات" value={`${summary?.totalGMV ?? 0} ج.م`} icon={Wallet} tone="accent" />
        <StatCard label="إجمالي العمولة" value={`${summary?.totalCommissionEarned ?? 0} ج.م`} icon={Banknote} />
        <StatCard label="عدد الطلبات" value={summary?.ordersCount ?? 0} icon={ShoppingCart} />
        <StatCard label="عدد المتاجر" value={summary?.storesCount ?? 0} icon={StoreIcon} />
      </div>

      <h2 className="mb-2 mt-5 font-display font-bold text-ink">العمولة حسب المتجر</h2>
      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="overflow-hidden rounded-xl2 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/5 text-right text-xs text-ink/40">
              <th className="px-4 py-3 font-medium">المتجر</th>
              <th className="px-4 py-3 font-medium">نسبة العمولة</th>
              <th className="px-4 py-3 font-medium">الطلبات</th>
              <th className="px-4 py-3 font-medium">إجمالي القيمة</th>
              <th className="px-4 py-3 font-medium">العمولة المستحقة</th>
            </tr>
          </thead>
          <tbody>
            {(byStore ?? []).map((row) => (
              <tr key={row.storeId} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-bold text-ink">{row.storeName}</td>
                <td className="px-4 py-3 text-ink/60">{row.commissionPercentage}%</td>
                <td className="px-4 py-3 text-ink/60">{row.ordersCompleted}</td>
                <td className="px-4 py-3 font-mono text-ink/60">{row.totalRevenue} ج.م</td>
                <td className="px-4 py-3 font-mono font-bold text-primary-700">{row.totalCommission} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && byStore?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لا توجد بيانات بعد</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminCommissionPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdminCommission />
    </RoleGate>
  );
}
