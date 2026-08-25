'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Pencil, Power, Image as ImageIcon, ArrowUp, ArrowDown } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Banner, Store } from '@/types';

interface BannerFormState {
  id?: string;
  title: string;
  link: string;
  image: string;
  storeId: string;
}

const EMPTY_FORM: BannerFormState = { title: '', link: '', image: '', storeId: '' };

function bannerToForm(banner: Banner): BannerFormState {
  return {
    id: banner.id,
    title: banner.title ?? '',
    link: banner.link ?? '',
    image: banner.image,
    storeId: banner.storeId ?? '',
  };
}

function BannersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BannerFormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: banners } = useQuery<Banner[]>({
    queryKey: ['admin-banners'],
    queryFn: () => api.get('/banners/all').then((r) => r.data),
  });

  // For the "which store is this banner for" picker — admin-facing list,
  // no pagination needed at this scale.
  const { data: storesRes } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', 'for-banners'],
    queryFn: () => api.get('/stores', { params: { limit: 200 } }).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] });

  const createBanner = useMutation({
    mutationFn: (payload: BannerFormState) => {
      if (!payload.image) throw new Error('الصورة مطلوبة');
      return api.post('/banners', {
        title: payload.title || undefined,
        link: payload.link || undefined,
        image: payload.image,
        storeId: payload.storeId || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateBanner = useMutation({
    mutationFn: (payload: BannerFormState) =>
      api.patch(`/banners/${payload.id}`, {
        title: payload.title || undefined,
        link: payload.link || undefined,
        image: payload.image || undefined,
        storeId: payload.storeId || null,
      }),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const removeBanner = useMutation({
    mutationFn: (id: string) => api.delete(`/banners/${id}`),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/banners/${id}/toggle-active`),
    onSuccess: invalidate,
  });

  // Order is swapped by writing each side's sortOrder — no dedicated
  // "reorder" endpoint exists, and swapping via the existing PATCH is
  // simpler than adding one just for this.
  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: Banner; b: Banner }) => {
      await api.patch(`/banners/${a.id}`, { sortOrder: b.sortOrder ?? 0 });
      await api.patch(`/banners/${b.id}`, { sortOrder: a.sortOrder ?? 0 });
    },
    onSuccess: invalidate,
  });

  const move = (index: number, direction: -1 | 1) => {
    if (!banners) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    reorder.mutate({ a: banners[index], b: banners[targetIndex] });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // "stores" bucket reused — no dedicated "banners" bucket provisioned
      // on Supabase yet (see upload.service.ts ALLOWED_BUCKETS).
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
        <h1 className="font-display text-lg font-bold text-ink">البانرات الإعلانية</h1>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          بانر جديد
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/40">تظهر هذه البانرات في شريط الإعلانات المتحرك أعلى الصفحة الرئيسية.</p>

      <div className="mt-3 flex flex-col gap-2">
        {(banners ?? []).map((banner, i) => (
          <div key={banner.id} className="flex items-center justify-between gap-2 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                <NextImage src={banner.image} alt={banner.title ?? ''} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <h4 className="truncate font-bold text-ink">{banner.title || 'بدون عنوان'}</h4>
                {banner.store?.name && (
                  <p className="truncate text-xs font-bold text-primary-700">{banner.store.name}</p>
                )}
                {banner.link && <p className="truncate text-xs text-ink/40" dir="ltr">{banner.link}</p>}
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    banner.isActive ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink/40'
                  }`}
                >
                  {banner.isActive ? 'مفعّل' : 'متوقف'}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700 disabled:opacity-30"
                title="تحريك لأعلى"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === (banners?.length ?? 0) - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700 disabled:opacity-30"
                title="تحريك لأسفل"
              >
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => toggleActive.mutate(banner.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => setForm(bannerToForm(banner))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => removeBanner.mutate(banner.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {banners?.length === 0 && <p className="py-8 text-center text-sm text-ink/40">لا توجد بانرات حاليًا</p>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">{form.id ? 'تعديل البانر' : 'بانر جديد'}</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.id) updateBanner.mutate(form);
                else createBanner.mutate(form);
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
                <span className="text-ink/60">{uploading ? 'جارِ الرفع...' : 'اختر صورة البانر'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <input
                placeholder="عنوان البانر (اختياري)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm text-ink/70 outline-none"
              >
                <option value="">بدون متجر (بانر عام للمنصة)</option>
                {(storesRes?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="رابط عند الضغط (اختياري)"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                dir="ltr"
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={createBanner.isPending || updateBanner.isPending || uploading || !form.image}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {createBanner.isPending || updateBanner.isPending ? 'جارِ الحفظ...' : 'حفظ البانر'}
              </button>
              {(createBanner.isError || updateBanner.isError) && (
                <p className="text-center text-xs text-red-500">
                  {getErrorMessage(createBanner.error ?? updateBanner.error, 'حدث خطأ أثناء الحفظ')}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function AdminBannersPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <BannersManager />
    </RoleGate>
  );
}
