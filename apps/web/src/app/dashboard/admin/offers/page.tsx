'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Power, Image as ImageIcon, Check, Ban } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Offer } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600',
  APPROVED: 'bg-green-50 text-green-600',
  REJECTED: 'bg-red-50 text-red-500',
};

function AdminOffers() {
  const queryClient = useQueryClient();

  const { data: offers, isLoading } = useQuery<Offer[]>({
    queryKey: ['admin-offers'],
    queryFn: () => api.get('/offers/mine').then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-offers'] });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/offers/${id}/toggle-active`),
    onSuccess: invalidate,
  });

  const removeOffer = useMutation({
    mutationFn: (id: string) => api.delete(`/offers/${id}`),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/offers/${id}/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/offers/${id}/reject`, { reason: undefined }),
    onSuccess: invalidate,
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">كل العروض</h1>
      <p className="mt-1 text-xs text-ink/40">
        عروض كل المتاجر — لإضافة عرض جديد استخدم لوحة المتجر الخاص به. العروض المميزة (لصفحة الهوم) تحتاج موافقتك هنا
        قبل ظهورها.
      </p>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(offers ?? []).map((offer) => (
          <div key={offer.id} className="flex items-center justify-between gap-2 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                {offer.image ? (
                  <NextImage src={offer.image} alt={offer.titleAr} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-700/30">
                    <ImageIcon size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="truncate font-bold text-ink">{offer.titleAr}</h4>
                <p className="truncate text-xs text-ink/40">{offer.store?.name ?? '—'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      offer.isActive ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    {offer.isActive ? 'مفعّل' : 'متوقف'}
                  </span>
                  {offer.isFeaturedHome && (
                    <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                      مميّز (هوم)
                    </span>
                  )}
                  {offer.isFeaturedHome && offer.approvalStatus && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[offer.approvalStatus]}`}
                    >
                      {STATUS_LABEL[offer.approvalStatus]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {offer.isFeaturedHome && offer.approvalStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => approve.mutate(offer.id)}
                    title="قبول"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => reject.mutate(offer.id)}
                    title="رفض"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
                  >
                    <Ban size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => toggleActive.mutate(offer.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => removeOffer.mutate(offer.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && offers?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد عروض</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminOffersPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdminOffers />
    </RoleGate>
  );
}

