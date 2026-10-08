'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';

interface CouponFormState {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  maxUses: string;
  minOrderValue: string;
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  maxUses: '',
  minOrderValue: '',
};

function CouponsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const { data: coupons, isLoading } = useQuery<any[]>({
    queryKey: ['coupons'],
    queryFn: () => api.get('/coupons').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/coupons', {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-ink">الكوبونات</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus size={14} />
            كوبون جديد
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="mt-3 flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
          >
            <input
              required
              placeholder="كود الكوبون (مثال: WELCOME10)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              dir="ltr"
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
              >
                <option value="percentage">نسبة مئوية %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
              <input
                required
                type="number"
                placeholder="القيمة"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="أقصى عدد استخدام (اختياري)"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
              />
              <input
                type="number"
                placeholder="أقل قيمة طلب (اختياري)"
                value={form.minOrderValue}
                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                className="w-1/2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {create.isPending ? 'جارِ الحفظ...' : 'إنشاء الكوبون'}
            </button>
          </form>
        )}

        {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(coupons ?? []).map((coupon) => (
          <div key={coupon.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <div>
              <h4 className="font-mono font-bold text-ink">{coupon.code}</h4>
              <p className="text-xs text-ink/50">
                {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} ج.م`}
                {coupon.maxUses ? ` · استُخدم ${coupon.usedCount}/${coupon.maxUses}` : ''}
              </p>
            </div>
            <button
              onClick={() => remove.mutate(coupon.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!isLoading && coupons?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد كوبونات بعد</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminCouponsPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <CouponsManager />
    </RoleGate>
  );
}
