'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, X, Image as ImageIcon } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { StoreType } from '@/types';

interface FormState {
  id?: string;
  nameAr: string;
  nameEn: string;
  image: string;
}

const EMPTY_FORM: FormState = { nameAr: '', nameEn: '', image: '' };

function StoreTypesManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const { data: types } = useQuery<StoreType[]>({
    queryKey: ['store-types'],
    queryFn: () => api.get('/store-types').then((r) => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['store-types'] });
    setForm(EMPTY_FORM);
  };

  const create = useMutation({
    mutationFn: () => api.post('/store-types', { nameAr: form.nameAr, nameEn: form.nameEn, image: form.image || undefined }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/store-types/${form.id}`, { nameAr: form.nameAr, nameEn: form.nameEn, image: form.image || undefined }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/store-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-types'] }),
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // No dedicated "categories" bucket exists yet on Supabase Storage —
      // reusing "products" here, same pattern already used for ads reusing
      // the "stores" bucket.
      fd.append('bucket', 'products');
      // Don't set Content-Type manually — axios needs to generate it itself
      // (including the multipart boundary) when the body is a FormData
      // instance.
      const { data } = await api.post<{ url: string }>('/upload/image', fd);
      setForm((f) => ({ ...f, image: data.url }));
    } finally {
      setUploading(false);
    }
  };

  const isEditing = !!form.id;

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">أنواع المتاجر (الكاتيجوري الرئيسية)</h1>
      <p className="mt-1 text-xs text-ink/40">
        دي الكاتيجوري اللي بتظهر في أعلى الصفحة الرئيسية (مطاعم، صيدليات، كافيهات...) — لكل واحدة صورة تظهر للعميل.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.nameAr.trim() || !form.nameEn.trim()) return;
          if (isEditing) update.mutate();
          else create.mutate();
        }}
        className="mt-3 flex flex-col gap-3 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
      >
        <div className="flex items-center gap-3">
          <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary-50 ring-1 ring-primary-100">
            {form.image ? (
              <NextImage src={form.image} alt="" fill className="object-cover" />
            ) : (
              <ImageIcon size={20} className="text-primary-700/40" />
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          <div className="text-xs text-ink/40">
            {uploading ? 'جارِ رفع الصورة...' : 'اضغط على الدائرة لرفع صورة الكاتيجوري'}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            required
            placeholder="الاسم بالعربي"
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            required
            placeholder="Name in English"
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            dir="ltr"
            className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={create.isPending || update.isPending || uploading}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus size={14} />
            {isEditing ? 'حفظ التعديل' : 'إضافة نوع جديد'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/50"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {(create.isError || update.isError) && (
          <p className="text-center text-xs text-red-500">
            {getErrorMessage(create.error ?? update.error, 'حدث خطأ أثناء الحفظ')}
          </p>
        )}
      </form>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(types ?? []).map((type) => (
          <div key={type.id} className="flex items-center justify-between gap-2 rounded-xl2 bg-white p-3 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary-50">
                {type.image ? (
                  <NextImage src={type.image} alt={type.nameAr} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-700/40">
                    <ImageIcon size={16} />
                  </div>
                )}
              </div>
              <span className="truncate font-bold text-ink">
                {type.nameAr} <span className="text-xs font-normal text-ink/40">({type.nameEn})</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setForm({ id: type.id, nameAr: type.nameAr, nameEn: type.nameEn, image: type.image ?? '' })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove.mutate(type.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
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
