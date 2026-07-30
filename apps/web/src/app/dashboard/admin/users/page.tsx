'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ADMIN_TABS } from '@/lib/dashboard-nav';

const ROLE_LABELS: Record<string, string> = {
  USER: 'مستخدم',
  STORE_OWNER: 'صاحب متجر',
  EMPLOYEE: 'موظف',
  DRIVER: 'مندوب توصيل',
  ADMIN: 'أدمن',
  SUPER_ADMIN: 'سوبر أدمن',
};

function UsersManager() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ items: any[]; total: number; limit: number }>({
    queryKey: ['admin-users', page],
    queryFn: () => api.get('/users', { params: { page, limit: 20 } }).then((r) => r.data),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">المستخدمين</h1>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(data?.items ?? []).map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
              <div>
                <h4 className="font-bold text-ink">{user.fullName}</h4>
                <p className="text-xs text-ink/40" dir="ltr">
                  {user.email}
                </p>
              </div>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-bold text-primary-700">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-ink/60 shadow-soft disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-xs text-ink/50">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-ink/60 shadow-soft disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </DashboardShell>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGate allow={['ADMIN', 'SUPER_ADMIN']}>
      <UsersManager />
    </RoleGate>
  );
}
