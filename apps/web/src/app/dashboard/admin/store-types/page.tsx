'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { StoreType } from '@/types';

function StoreTypesManager() {
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');

  const { data: types } = useQuery<StoreType[]>({
    queryKey: ['store-types'],
    queryFn: () => api.get('/store-types').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/store-types', { nameAr, nameEn }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-types'] });
      setNameAr('');
      setNameEn('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/store-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-types'] }),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">أنواع المتاجر</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nameAr.trim() && nameEn.trim()) create.mutate();
        }}
        className="mt-3 flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
      >
          <div className="flex gap-2">
            <input
              required
              placeholder="الاسم بالعربي"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <input
              required
              placeholder="Name in English"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir="ltr"
              className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center justify-center gap-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus size={14} />
            إضافة نوع جديد
          </button>
        </form>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(types ?? []).map((type) => (
          <div key={type.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <span className="font-bold text-ink">
              {type.nameAr} <span className="text-xs font-normal text-ink/40">({type.nameEn})</span>
            </span>
            <button
              onClick={() => remove.mutate(type.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

export default function StoreTypesPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <StoreTypesManager />
    </RoleGate>
  );
}
