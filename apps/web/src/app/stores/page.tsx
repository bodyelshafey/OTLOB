'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { StoreCard } from '@/components/StoreCard';
import type { Store } from '@/types';

export default function StoresPage() {
  const searchParams = useSearchParams();
  const storeTypeId = searchParams.get('storeTypeId') ?? undefined;
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', storeTypeId, search],
    queryFn: () =>
      api
        .get('/stores', { params: { storeTypeId, search: search || undefined, limit: 50 } })
        .then((r) => r.data),
  });

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-2 rounded-xl2 bg-white px-4 py-3 shadow-soft lg:max-w-md">
        <Search size={18} className="text-ink/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم المتجر..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 lg:col-span-3 xl:col-span-4">جارِ التحميل...</p>}
        {(data?.items ?? []).map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
        {!isLoading && data?.items?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 lg:col-span-3 xl:col-span-4">لا توجد نتائج مطابقة</p>
        )}
      </div>
    </div>
  );
}
