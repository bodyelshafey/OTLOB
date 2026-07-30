'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store } from '@/types';

interface OfferFormState {
  titleAr: string;
  titleEn: string;
  oldPrice: string;
  newPrice: string;
  discountPercentage: string;
}

const EMPTY_FORM: OfferFormState = {
  titleAr: '',
  titleEn: '',
  oldPrice: '',
  newPrice: '',
  discountPercentage: '',
};

function OffersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfferFormState | null>(null);

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: offers } = useQuery<any[]>({
    queryKey: ['store-offers', store?.id],
    queryFn: () => api.get('/offers', { params: { storeId: store!.id } }).then((r) => r.data),
    enabled: !!store,
  });

  const createOffer = useMutation({
    mutationFn: (payload: OfferFormState) =>
      api.post('/offers', {
        storeId: store!.id,
        titleAr: payload.titleAr,
        titleEn: payload.titleEn || payload.titleAr,
        oldPrice: payload.oldPrice ? Number(payload.oldPrice) : undefined,
        newPrice: payload.newPrice ? Number(payload.newPrice) : undefined,
        discountPercentage: payload.discountPercentage ? Number(payload.discountPercentage) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-offers', store?.id] });
      setForm(null);
    },
  });

  const removeOffer = useMutation({
    mutationFn: (id: string) => api.delete(`/offers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-offers', store?.id] }),
  });

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">العروض</h1>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          عرض جديد
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(offers ?? []).map((offer) => (
          <div key={offer.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <div>
              <h4 className="font-bold text-ink">{offer.titleAr}</h4>
              {offer.newPrice && (
                <p className="font-mono text-sm text-primary-700">
                  <span className="text-ink/40 line-through">{offer.oldPrice}</span> {offer.newPrice} ج.م
                </p>
              )}
            </div>
            <button
              onClick={() => removeOffer.mutate(offer.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {offers?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد عروض حاليًا</p>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">عرض جديد</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createOffer.mutate(form);
              }}
            >
              <input
                required
                placeholder="عنوان العرض"
                value={form.titleAr}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="السعر قبل"
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
                <input
                  type="number"
                  placeholder="السعر بعد"
                  value={form.newPrice}
                  onChange={(e) => setForm({ ...form, newPrice: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <input
                type="number"
                placeholder="نسبة الخصم % (اختياري)"
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={createOffer.isPending}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {createOffer.isPending ? 'جارِ الحفظ...' : 'حفظ العرض'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function StoreOffersPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <OffersManager />
    </RoleGate>
  );
}
