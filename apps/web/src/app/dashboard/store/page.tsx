'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, ShoppingCart, Star, Wallet, Power, Percent, Banknote, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store, WorkingHour } from '@/types';

const DAY_LABELS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function defaultDay(dayOfWeek: number): WorkingHour {
  return { dayOfWeek, openTime: '09:00', closeTime: '23:00', isClosed: false };
}

function WorkingHoursEditor({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: hours } = useQuery<WorkingHour[]>({
    queryKey: ['store-hours', storeId],
    queryFn: () => api.get(`/stores/${storeId}/hours`).then((r) => r.data),
  });

  const [days, setDays] = useState<WorkingHour[] | null>(null);

  // Seed local editable state once the server data arrives — a store that
  // never configured hours gets sensible defaults for all 7 days rather
  // than an empty form.
  useEffect(() => {
    if (hours && days === null) {
      const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
      setDays(Array.from({ length: 7 }, (_, i) => byDay.get(i) ?? defaultDay(i)));
    }
  }, [hours, days]);

  const save = useMutation({
    mutationFn: (payload: WorkingHour[]) => api.patch(`/stores/${storeId}/hours`, { days: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-hours', storeId] });
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
    },
  });

  if (!days) return null;

  const updateDay = (index: number, patch: Partial<WorkingHour>) => {
    setDays((prev) => prev!.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-1.5">
        <Clock size={16} className="text-primary-700" />
        <h2 className="font-display font-bold text-ink">مواعيد العمل</h2>
      </div>
      <p className="mb-2 text-xs text-ink/40">
        خارج المواعيد دي المتجر هيظهر للعميل "مغلق الآن" ومش هيقدر يكمل طلب — حتى لو زرار "فتح المتجر" فوق مفعّل.
      </p>
      <div className="space-y-1.5 rounded-xl2 bg-white p-3 shadow-soft">
        {days.map((d, i) => (
          <div key={d.dayOfWeek} className="flex flex-wrap items-center gap-2 border-b border-ink/5 py-1.5 last:border-0">
            <span className="w-16 shrink-0 text-xs font-bold text-ink">{DAY_LABELS[d.dayOfWeek]}</span>
            <label className="flex items-center gap-1 text-[11px] text-ink/50">
              <input
                type="checkbox"
                checked={d.isClosed}
                onChange={(e) => updateDay(i, { isClosed: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              إجازة
            </label>
            {!d.isClosed && (
              <>
                <input
                  type="time"
                  value={d.openTime}
                  onChange={(e) => updateDay(i, { openTime: e.target.value })}
                  className="rounded-lg bg-primary-50 px-2 py-1 text-xs outline-none"
                />
                <span className="text-xs text-ink/30">إلى</span>
                <input
                  type="time"
                  value={d.closeTime}
                  onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                  className="rounded-lg bg-primary-50 px-2 py-1 text-xs outline-none"
                />
              </>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => save.mutate(days)}
            disabled={save.isPending}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {save.isPending ? 'جارِ الحفظ...' : 'حفظ المواعيد'}
          </button>
          {save.isSuccess && <span className="text-xs text-green-600">تم الحفظ</span>}
          {save.isError && (
            <span className="text-xs text-red-500">{getErrorMessage(save.error, 'حدث خطأ أثناء الحفظ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StoreOverview() {
  const queryClient = useQueryClient();

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: summary } = useQuery({
    queryKey: ['store-summary', store?.id],
    queryFn: () => api.get(`/reports/store/${store!.id}`).then((r) => r.data),
    enabled: !!store,
  });

  const toggleOpen = useMutation({
    mutationFn: () => api.patch(`/stores/${store!.id}/toggle-open`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-store'] }),
  });

  if (!stores) return <p className="px-4 py-10 text-center text-sm text-ink/40">جارِ التحميل...</p>;

  if (!store) {
    return (
      <p className="px-4 py-10 text-center text-sm text-ink/40">
        لا يوجد متجر مرتبط بحسابك بعد. تواصل مع الدعم لإضافة متجرك.
      </p>
    );
  }

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
        <div>
          <h1 className="font-display font-bold text-ink">{store.name}</h1>
          <p className="text-xs text-ink/50">{store.isOpen ? 'المتجر مفتوح حاليًا' : 'المتجر مغلق حاليًا'}</p>
        </div>
        <button
          onClick={() => toggleOpen.mutate()}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${
            store.isOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}
        >
          <Power size={14} />
          {store.isOpen ? 'إغلاق المتجر' : 'فتح المتجر'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="طلبات مكتملة" value={summary?.ordersCompleted ?? 0} icon={ShoppingCart} />
        <StatCard
          label="إجمالي قيمة الطلبات"
          value={`${summary?.totalRevenue ?? 0} ج.م`}
          icon={Wallet}
          tone="accent"
        />
        <StatCard
          label="متوسط التقييم"
          value={Number(summary?.averageRating ?? 0).toFixed(1)}
          icon={Star}
        />
        <StatCard label="عدد التقييمات" value={summary?.reviewsCount ?? 0} icon={Package} />
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-display font-bold text-ink">العمولة والمستحقات</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="نسبة العمولة"
            value={`${summary?.commissionPercentage ?? 10}%`}
            icon={Percent}
          />
          <StatCard
            label="إجمالي العمولة المستحقة"
            value={`${summary?.totalCommissionPaid ?? 0} ج.م`}
            icon={Banknote}
            tone="accent"
          />
          <StatCard
            label="صافي مستحقاتك"
            value={`${summary?.netEarnings ?? 0} ج.م`}
            icon={Wallet}
          />
        </div>
        <p className="mt-2 text-xs text-ink/40">
          يتم احتساب العمولة تلقائيًا على كل طلب مكتمل من الخادم — {summary?.commissionPercentage ?? 10}% من قيمة
          الطلب لصالح المنصة، والباقي صافي مستحقاتك.
        </p>
      </div>

      <WorkingHoursEditor storeId={store.id} />
    </DashboardShell>
  );
}

export default function StoreDashboardPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <StoreOverview />
    </RoleGate>
  );
}
