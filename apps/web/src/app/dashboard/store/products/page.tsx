'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Category, Product, Store } from '@/types';

interface ProductFormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  image: string;
  categoryId: string;
  isAvailable: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  price: '',
  image: '',
  categoryId: '',
  isAvailable: true,
};

function ProductsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', 'store', store?.id],
    queryFn: () => api.get('/categories', { params: { storeId: store!.id } }).then((r) => r.data),
    enabled: !!store,
  });

  const { data: productsRes } = useQuery<{ items: Product[] }>({
    queryKey: ['products', 'store', store?.id],
    queryFn: () => api.get('/products', { params: { storeId: store!.id, limit: 100 } }).then((r) => r.data),
    enabled: !!store,
  });

  const createCategory = useMutation({
    mutationFn: (nameAr: string) =>
      api.post('/categories', {
        nameAr,
        nameEn: nameAr,
        storeId: store!.id,
        storeTypeId: store!.storeType?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'store', store?.id] });
      setNewCategoryName('');
      setShowCategoryForm(false);
    },
  });

  const saveProduct = useMutation({
    mutationFn: (payload: ProductFormState) => {
      const body = {
        name: payload.name,
        description: payload.description || undefined,
        price: Number(payload.price),
        image: payload.image || undefined,
        categoryId: payload.categoryId,
        isAvailable: payload.isAvailable,
        storeId: store!.id,
      };
      return payload.id ? api.patch(`/products/${payload.id}`, body) : api.post('/products', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'store', store?.id] });
      setForm(null);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', 'store', store?.id] }),
  });

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">المنتجات</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryForm((v) => !v)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-700 shadow-soft"
          >
            + قسم
          </button>
          <button
            onClick={() =>
              setForm({ ...EMPTY_FORM, categoryId: categories?.[0]?.id ?? '' })
            }
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus size={14} />
            منتج جديد
          </button>
        </div>
      </div>

      {showCategoryForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newCategoryName.trim()) createCategory.mutate(newCategoryName.trim());
          }}
          className="mt-3 flex gap-2 rounded-xl2 bg-white p-3 shadow-soft lg:max-w-md"
        >
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="اسم القسم (مثال: مقبلات)"
            className="flex-1 rounded-xl bg-primary-50 px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={createCategory.isPending}
            className="rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            حفظ
          </button>
        </form>
      )}

      {!categories?.length && (
        <p className="mt-3 rounded-xl2 bg-orange-50 px-4 py-3 text-xs font-bold text-accent-600">
          أضف قسم واحد على الأقل قبل ما تضيف منتجات
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(productsRes?.items ?? []).map((product) => (
          <div key={product.id} className="flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft">
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-bold text-ink">{product.name}</h4>
              <p className="font-mono text-sm text-primary-700">{product.price} ج.م</p>
              {!product.isAvailable && (
                <span className="text-[10px] font-bold text-red-500">غير متاح حاليًا</span>
              )}
            </div>
            <button
              onClick={() =>
                setForm({
                  id: product.id,
                  name: product.name,
                  description: product.description ?? '',
                  price: String(product.price),
                  image: product.image ?? '',
                  categoryId: product.categoryId,
                  isAvailable: product.isAvailable,
                })
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => deleteProduct.mutate(product.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {productsRes?.items?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد منتجات بعد</p>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">
                {form.id ? 'تعديل المنتج' : 'منتج جديد'}
              </h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveProduct.mutate(form);
              }}
            >
              <input
                required
                placeholder="اسم المنتج"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <textarea
                placeholder="الوصف (اختياري)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="السعر"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">اختر القسم</option>
                  {(categories ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <input
                placeholder="رابط صورة المنتج (اختياري)"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                dir="ltr"
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
                />
                متاح للطلب
              </label>

              <button
                type="submit"
                disabled={saveProduct.isPending || !form.categoryId}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {saveProduct.isPending ? 'جارِ الحفظ...' : 'حفظ المنتج'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function StoreProductsPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <ProductsManager />
    </RoleGate>
  );
}
