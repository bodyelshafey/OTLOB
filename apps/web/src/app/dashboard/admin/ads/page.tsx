'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Power, Image as ImageIcon, Check, Ban } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Ad, Store } from '@/types';

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

interface AdFormState {
  title: string;
  link: string;
  image: string;
  storeId: string; // '' = platform-wide
}

const EMPTY_FORM: AdFormState = { title: '', link: '', image: '', storeId: '' };

function AdsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdFormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: ads } = useQuery<Ad[]>({
    queryKey: ['admin-ads'],
    queryFn: () => api.get('/ads/mine').then((r) => r.data),
  });

  const { data: storesRes } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', 'for-ads'],
    queryFn: () => api.get('/stores', { params: { limit: 100 } }).then((r) => r.data),
  });

  const { data: monthlyLimit } = useQuery<{ value: number }>({
    queryKey: ['ads-monthly-limit'],
    queryFn: () => api.get('/ads/settings/monthly-limit').then((r) => r.data),
  });
  const [limitInput, setLimitInput] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] });

  const setLimit = useMutation({
    mutationFn: (value: number) => api.patch('/ads/settings/monthly-limit', { value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ads-monthly-limit'] }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/ads/${id}/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/ads/${id}/reject`, { reason: undefined }),
    onSuccess: invalidate,
  });

  const createAd = useMutation({
    mutationFn: (payload: AdFormState) =>
      api.post('/ads', {
        title: payload.title || undefined,
        link: payload.link || undefined,
        image: payload.image || undefined,
        storeId: payload.storeId || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const removeAd = useMutation({
    mutationFn: (id: string) => api.delete(`/ads/${id}`),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/ads/${id}/toggle-active`),
    onSuccess: invalidate,
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'stores');
      // Don't set Content-Type manually — axios needs to generate it itself
      // (including the multipart boundary) when the body is a FormData
      // instance. A hardcoded header here has no boundary, so the backend
      // can't parse the body and the upload fails with "No file provided".
      const { data } = await api.post<{ url: string }>('/upload/image', fd);
      setForm({ ...form, image: data.url });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">الإعلانات</h1>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          إعلان جديد
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/40">
        يشمل هذا إعلانات كل المتاجر بالإضافة للإعلانات العامة. لإدارة بانر الصفحة الرئيسية استخدم تبويب البانرات.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl2 bg-white p-3 shadow-soft">
        <span className="text-xs font-bold text-ink/60">الحد الشهري الافتراضي للإعلانات لكل متجر:</span>
        <span className="text-sm font-bold text-primary-700">{monthlyLimit?.value ?? '—'}</span>
        <input
          type="number"
          min={1}
          placeholder="قيمة جديدة"
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
          className="mr-auto w-20 rounded-lg bg-primary-50 px-2 py-1 text-xs outline-none"
        />
        <button
          onClick={() => limitInput && setLimit.mutate(Number(limitInput))}
          disabled={!limitInput || setLimit.isPending}
          className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
        >
          حفظ
        </button>
      </div>
      {setLimit.isError && (
        <p className="mt-1 text-xs text-red-500">{getErrorMessage(setLimit.error, 'حدث خطأ أثناء الحفظ')}</p>
      )}
      {setLimit.isSuccess && <p className="mt-1 text-xs text-green-600">تم الحفظ</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(ads ?? []).map((ad) => (
          <div key={ad.id} className="flex items-center justify-between gap-2 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                {ad.image ? (
                  <NextImage src={ad.image} alt={ad.title ?? ''} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-700/30">
                    <ImageIcon size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="truncate font-bold text-ink">{ad.title || 'بدون عنوان'}</h4>
                <p className="truncate text-xs text-ink/40">{ad.store?.name ?? 'إعلان عام'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      ad.isActive ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    {ad.isActive ? 'مفعّل' : 'متوقف'}
                  </span>
                  {ad.approvalStatus && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[ad.approvalStatus]}`}
                    >
                      {STATUS_LABEL[ad.approvalStatus]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {ad.approvalStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => approve.mutate(ad.id)}
                    title="قبول"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => reject.mutate(ad.id)}
                    title="رفض"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
                  >
                    <Ban size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => toggleActive.mutate(ad.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => removeAd.mutate(ad.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {ads?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد إعلانات حاليًا</p>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">إعلان جديد</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createAd.mutate(form);
              }}
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-xl2 bg-primary-50 p-2.5 text-sm">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                  {form.image ? (
                    <NextImage src={form.image} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary-700/30">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <span className="text-ink/60">{uploading ? 'جارِ الرفع...' : 'اختر صورة الإعلان'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="">إعلان عام (غير مرتبط بمتجر)</option>
                {(storesRes?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="عنوان الإعلان"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <input
                placeholder="رابط عند الضغط (اختياري)"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                dir="ltr"
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={createAd.isPending || uploading}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {createAd.isPending ? 'جارِ الحفظ...' : 'حفظ الإعلان'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function AdminAdsPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AdsManager />
    </RoleGate>
  );
}
