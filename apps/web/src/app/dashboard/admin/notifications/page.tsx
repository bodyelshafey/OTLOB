'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Send, Users2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';
import type { Store } from '@/types';

type TargetType = 'ALL' | 'ROLE' | 'USER' | 'STORE_CUSTOMERS';
type CampaignType = 'PROMO' | 'SYSTEM' | 'ADMIN_ANNOUNCEMENT';
type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'FAILED';

interface Campaign {
  id: string;
  title: string;
  bodyAr: string;
  bodyEn?: string | null;
  type: CampaignType;
  targetType: TargetType;
  targetRole?: string | null;
  targetUserId?: string | null;
  targetStoreId?: string | null;
  status: CampaignStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  recipientCount?: number | null;
  createdAt: string;
}

interface FormState {
  title: string;
  bodyAr: string;
  bodyEn: string;
  type: CampaignType;
  targetType: TargetType;
  targetRole: string;
  targetUserId: string;
  targetStoreId: string;
  scheduledAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  bodyAr: '',
  bodyEn: '',
  type: 'PROMO',
  targetType: 'ALL',
  targetRole: 'USER',
  targetUserId: '',
  targetStoreId: '',
  scheduledAt: '',
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدولة',
  SENT: 'تم الإرسال',
  FAILED: 'فشلت',
};
const STATUS_TONE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-ink/5 text-ink/50',
  SCHEDULED: 'bg-accent/10 text-accent-600',
  SENT: 'bg-green-50 text-green-600',
  FAILED: 'bg-red-50 text-red-500',
};
const TARGET_LABEL: Record<TargetType, string> = {
  ALL: 'كل المستخدمين',
  ROLE: 'حسب الدور',
  USER: 'مستخدم محدد',
  STORE_CUSTOMERS: 'عملاء متجر معيّن',
};

function CampaignsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['admin-campaigns'],
    queryFn: () => api.get('/admin/notification-campaigns').then((r) => r.data),
  });

  const { data: storesRes } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', 'for-campaigns'],
    queryFn: () => api.get('/stores', { params: { limit: 100 } }).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });

  const buildPayload = (f: FormState) => ({
    title: f.title,
    bodyAr: f.bodyAr,
    bodyEn: f.bodyEn || undefined,
    type: f.type,
    targetType: f.targetType,
    targetRole: f.targetType === 'ROLE' ? f.targetRole : undefined,
    targetUserId: f.targetType === 'USER' ? f.targetUserId : undefined,
    targetStoreId: f.targetType === 'STORE_CUSTOMERS' ? f.targetStoreId : undefined,
    scheduledAt: f.scheduledAt || undefined,
  });

  const create = useMutation({
    mutationFn: (f: FormState) => api.post('/admin/notification-campaigns', buildPayload(f)),
    onSuccess: () => {
      invalidate();
      setForm(null);
      setPreviewCount(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/notification-campaigns/${id}`),
    onSuccess: invalidate,
  });

  const sendNow = useMutation({
    mutationFn: (id: string) => {
      if (!confirm('سيتم إرسال هذا الإشعار للجمهور المستهدف الآن. متابعة؟')) return Promise.reject();
      return api.post(`/admin/notification-campaigns/${id}/send`);
    },
    onSuccess: invalidate,
  });

  const previewAudience = useMutation({
    mutationFn: (f: FormState) =>
      api.post<{ count: number }>('/admin/notification-campaigns/preview-audience', buildPayload(f)).then((r) => r.data),
    onSuccess: (data) => setPreviewCount(data.count),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">حملات الإشعارات</h1>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setPreviewCount(null);
          }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          حملة جديدة
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/40">
        إشعارات ترويجية أو إعلانات نظام تُرسل داخل التطبيق وكـ push notification لجمهور مستهدف.
      </p>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 flex flex-col gap-2">
        {(campaigns ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-bold text-ink">{c.title}</h4>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink/50">{c.bodyAr}</p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-ink/40">
                <span className="flex items-center gap-1">
                  <Users2 size={12} />
                  {TARGET_LABEL[c.targetType]}
                </span>
                {c.scheduledAt && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(c.scheduledAt).toLocaleString('ar-EG')}
                  </span>
                )}
                {c.recipientCount != null && <span>وصل لـ {c.recipientCount} مستخدم</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {c.status !== 'SENT' && (
                <button
                  onClick={() => sendNow.mutate(c.id)}
                  title="إرسال الآن"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
                >
                  <Send size={14} />
                </button>
              )}
              <button
                onClick={() => remove.mutate(c.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && campaigns?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لا توجد حملات حتى الآن</p>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">حملة جديدة</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex max-h-[70vh] flex-col gap-2 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate(form);
              }}
            >
              <input
                required
                placeholder="عنوان الإشعار"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <textarea
                required
                placeholder="نص الإشعار (عربي)"
                value={form.bodyAr}
                onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                rows={2}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <textarea
                placeholder="نص الإشعار (إنجليزي - اختياري)"
                value={form.bodyEn}
                onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
                rows={2}
                dir="ltr"
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />

              <label className="mt-1 text-xs font-bold text-ink/50">نوع الإشعار</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CampaignType })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="PROMO">عرض ترويجي</option>
                <option value="SYSTEM">إشعار نظام</option>
                <option value="ADMIN_ANNOUNCEMENT">إعلان إدارة</option>
              </select>

              <label className="mt-1 text-xs font-bold text-ink/50">الجمهور المستهدف</label>
              <select
                value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value as TargetType })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="ALL">كل المستخدمين</option>
                <option value="ROLE">حسب الدور</option>
                <option value="USER">مستخدم محدد (بالمعرف)</option>
                <option value="STORE_CUSTOMERS">عملاء متجر معيّن</option>
              </select>

              {form.targetType === 'ROLE' && (
                <select
                  value={form.targetRole}
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                  className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                >
                  <option value="USER">العملاء</option>
                  <option value="STORE_OWNER">أصحاب المتاجر</option>
                  <option value="DRIVER">مندوبي التوصيل</option>
                </select>
              )}
              {form.targetType === 'USER' && (
                <input
                  placeholder="معرّف المستخدم (User ID)"
                  value={form.targetUserId}
                  onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                  dir="ltr"
                  className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
              )}
              {form.targetType === 'STORE_CUSTOMERS' && (
                <select
                  value={form.targetStoreId}
                  onChange={(e) => setForm({ ...form, targetStoreId: e.target.value })}
                  className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">اختر متجرًا</option>
                  {(storesRes?.items ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => previewAudience.mutate(form)}
                className="mt-1 self-start text-xs font-bold text-primary-700 underline"
              >
                {previewAudience.isPending ? 'جارِ الحساب...' : 'معاينة عدد المستلمين'}
              </button>
              {previewCount != null && (
                <p className="text-xs text-ink/50">سيصل هذا الإشعار لِـ {previewCount} مستخدم تقريبًا</p>
              )}

              <label className="mt-1 text-xs font-bold text-ink/50">جدولة الإرسال (اختياري)</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <p className="text-[11px] text-ink/40">
                اتركه فارغًا لحفظ الحملة كمسودة، ثم اضغط زر الإرسال لاحقًا. عند تحديد موعد، سيتم الإرسال تلقائيًا في هذا الوقت.
              </p>

              <button
                type="submit"
                disabled={create.isPending}
                className="mt-2 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {create.isPending ? 'جارِ الحفظ...' : form.scheduledAt ? 'جدولة الحملة' : 'حفظ كمسودة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function AdminNotificationCampaignsPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <CampaignsManager />
    </RoleGate>
  );
}
