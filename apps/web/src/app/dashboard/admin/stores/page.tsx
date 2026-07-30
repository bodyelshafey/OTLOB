'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Store } from '@/types';

function AdminStores() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ items: Store[] }>({
    queryKey: ['admin-stores', search],
    queryFn: () => api.get('/stores', { params: { search: search || undefined, limit: 100 } }).then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">كل المتاجر</h1>

      <div className="mt-3 flex items-center gap-2 rounded-xl2 bg-white px-4 py-2.5 shadow-soft lg:max-w-md">
          <Search size={16} className="text-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المتجر..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.items ?? []).map((store) => (
          <div key={store.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <div>
              <h4 className="font-bold text-ink">{store.name}</h4>
              <p className="flex items-center gap-1 text-xs text-ink/50">
                <Star size={12} className="fill-accent text-accent" />
                {Number(store.rating).toFixed(1)} · {store.storeType?.nameAr}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                store.isOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
              }`}
            >
              {store.isOpen ? 'مفتوح' : 'مغلق'}
            </span>
          </div>
        ))}
        {!isLoading && data?.items?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد نتائج</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminStoresPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdminStores />
    </RoleGate>
  );
}
