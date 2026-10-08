'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Pencil, Power, Image as ImageIcon } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store, Ad } from '@/types';

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
  id?: string;
  title: string;
  link: string;
  image: string;
}

const EMPTY_FORM: AdFormState = { title: '', link: '', image: '' };

function adToForm(ad: Ad): AdFormState {
  return { id: ad.id, title: ad.title ?? '', link: ad.link ?? '', image: ad.image ?? '' };
}

function AdsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdFormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: ads } = useQuery<Ad[]>({
    queryKey: ['store-ads', store?.id],
    queryFn: () => api.get('/ads/mine', { params: { storeId: store!.id } }).then((r) => r.data),
    enabled: !!store,
  });

  const { data: quota } = useQuery<{
    limit: number;
    used: number;
    remaining: number;
    pending: number;
    approved: number;
    rejected: number;
  }>({
    queryKey: ['ads-quota', store?.id],
    queryFn: () => api.get('/ads/quota', { params: { storeId: store!.id } }).then((r) => r.data),
    enabled: !!store,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['store-ads', store?.id] });
    queryClient.invalidateQueries({ queryKey: ['ads-quota', store?.id] });
  };

  const createAd = useMutation({
    mutationFn: (payload: AdFormState) =>
      api.post('/ads', { storeId: store!.id, title: payload.title, link: payload.link || undefined, image: payload.image || undefined }),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateAd = useMutation({
    mutationFn: (payload: AdFormState) =>
      api.patch(`/ads/${payload.id}`, { title: payload.title, link: payload.link || undefined, image: payload.image || undefined }),
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
      // "stores" bucket reused here — dedicated "ads" storage bucket isn't
      // provisioned on Supabase yet (see upload.service.ts ALLOWED_BUCKETS).
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

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">الإعلانات</h1>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          disabled={!!quota && quota.remaining <= 0}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          <Plus size={14} />
          إعلان جديد
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/40">
        الإعلانات هنا خاصة بمتجرك فقط، وتظهر ضمن شريط الإعلانات بعد موافقة الإدارة.
      </p>

      {quota && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl2 bg-white p-3 text-center shadow-soft">
            <p className="text-lg font-bold text-ink">
              {quota.used}/{quota.limit}
            </p>
            <p className="text-[10px] text-ink/40">مستخدم هذا الشهر</p>
          </div>
          <div className="rounded-xl2 bg-white p-3 text-center shadow-soft">
            <p className="text-lg font-bold text-primary-700">{quota.remaining}</p>
            <p className="text-[10px] text-ink/40">متبقي</p>
          </div>
          <div className="rounded-xl2 bg-white p-3 text-center shadow-soft">
            <p className="text-lg font-bold text-amber-600">{quota.pending}</p>
            <p className="text-[10px] text-ink/40">بانتظار المراجعة</p>
          </div>
          <div className="rounded-xl2 bg-white p-3 text-center shadow-soft">
            <p className="text-lg font-bold text-green-600">{quota.approved}</p>
            <p className="text-[10px] text-ink/40">مقبول</p>
          </div>
        </div>
      )}

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
                {ad.approvalStatus === 'REJECTED' && ad.rejectionReason && (
                  <p className="mt-0.5 text-[10px] text-red-500">سبب الرفض: {ad.rejectionReason}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => toggleActive.mutate(ad.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => setForm(adToForm(ad))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Pencil size={14} />
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
              <h2 className="font-display font-bold text-ink">{form.id ? 'تعديل الإعلان' : 'إعلان جديد'}</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.id) updateAd.mutate(form);
                else createAd.mutate(form);
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
              <input
                required
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
                disabled={createAd.isPending || updateAd.isPending || uploading}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {createAd.isPending || updateAd.isPending ? 'جارِ الحفظ...' : 'حفظ الإعلان'}
              </button>
              {(createAd.isError || updateAd.isError) && (
                <p className="text-center text-xs text-red-500">
                  {getErrorMessage(createAd.error ?? updateAd.error, 'حدث خطأ، حاول مرة أخرى')}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function StoreAdsPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <AdsManager />
    </RoleGate>
  );
}
