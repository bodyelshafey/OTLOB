'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';

interface AuditLogEntry {
  id: string;
  action: string;
  tableName: string;
  recordId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { fullName: string; email: string; role: string } | null;
}

const ACTION_LABEL: Record<string, string> = {
  STORE_UPDATED: 'تعديل متجر',
  STORE_SUSPENDED: 'تعليق متجر',
  STORE_COMMISSION_CHANGED: 'تغيير نسبة العمولة',
  OFFER_DELETED: 'حذف عرض',
  BANNER_CREATED: 'إنشاء بانر',
  BANNER_UPDATED: 'تعديل بانر',
  BANNER_DELETED: 'حذف بانر',
  USER_ENABLED: 'تفعيل مستخدم',
  USER_DISABLED: 'تعطيل مستخدم',
  USER_ROLE_CHANGED: 'تغيير دور مستخدم',
};

function AuditLogViewer() {
  const [action, setAction] = useState('');
  const [tableName, setTableName] = useState('');

  const { data, isLoading } = useQuery<{ items: AuditLogEntry[]; total: number }>({
    queryKey: ['admin-audit-log', action, tableName],
    queryFn: () =>
      api
        .get('/admin/audit-logs', { params: { action: action || undefined, tableName: tableName || undefined } })
        .then((r) => r.data),
  });

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-primary-700" />
        <h1 className="font-display text-lg font-bold text-ink">سجل العمليات الإدارية</h1>
      </div>
      <p className="mt-1 text-xs text-ink/40">
        سجل بكل العمليات الحساسة اللي تمت من حسابات الأدمن — تعليق متاجر، تغيير أدوار، تعديل العمولة، وغيرها.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="rounded-xl2 bg-white px-4 py-2.5 text-sm shadow-soft outline-none"
        >
          <option value="">كل الأنواع</option>
          <option value="stores">المتاجر</option>
          <option value="offers">العروض</option>
          <option value="banners">البانرات</option>
          <option value="users">المستخدمين</option>
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl2 bg-white px-4 py-2.5 text-sm shadow-soft outline-none"
        >
          <option value="">كل العمليات</option>
          {Object.entries(ACTION_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 overflow-hidden rounded-xl2 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/5 text-right text-xs text-ink/40">
              <th className="px-4 py-3 font-medium">العملية</th>
              <th className="px-4 py-3 font-medium">بواسطة</th>
              <th className="px-4 py-3 font-medium">تفاصيل</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">التوقيت</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((entry) => (
              <tr key={entry.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-bold text-ink">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                <td className="px-4 py-3 text-ink/60">{entry.user?.fullName ?? '—'}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-xs text-ink/50" dir="ltr">
                  {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/40" dir="ltr">
                  {entry.ipAddress ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink/40">{new Date(entry.createdAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.items?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لا توجد عمليات مسجّلة بعد</p>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminAuditLogPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <AuditLogViewer />
    </RoleGate>
  );
}
