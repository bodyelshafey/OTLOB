'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Phase 3/22 (2026-09-13): server-side search + the "إضافة كمندوب" action,
// wired to the already-secure PATCH /users/:id/promote-to-driver backend
// endpoint (ADMIN/SUPER_ADMIN only, refuses admin targets, audits the
// action — see UsersService.promoteToDriver). This page is the ONLY place
// that calls it; there is still no self-service way to become a driver.
function UsersManager() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: any[]; total: number; limit: number }>({
    queryKey: ['admin-users', page, search],
    queryFn: () => api.get('/users', { params: { page, limit: 20, search: search || undefined } }).then((r) => r.data),
  });

  const promote = useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}/promote-to-driver`, {}),
    onSuccess: () => {
      setPromotingId(null);
      setPromoteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      setPromoteError(err?.response?.data?.message ?? 'تعذر ترقية المستخدم');
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DashboardShell title="لوحة الأدمن" tabs={ADMIN_TABS}>
      <h1 className="font-display text-lg font-bold text-ink">المستخدمين</h1>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل أو الهاتف"
          dir="ltr"
          className="flex-1 rounded-xl2 bg-white px-4 py-2 text-sm shadow-soft outline-none"
        />
        <button type="submit" className="rounded-xl2 bg-primary px-4 py-2 text-sm font-bold text-white">
          بحث
        </button>
      </form>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.items ?? []).map((user) => {
          const isStaffRole = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
          const isAlreadyDriver = user.role === 'DRIVER';
          return (
            <div key={user.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
              <div>
                <h4 className="font-bold text-ink">{user.fullName}</h4>
                <p className="text-xs text-ink/40" dir="ltr">
                  {user.phone ?? '—'}
                </p>
                {user.email && (
                  <p className="text-xs text-ink/40" dir="ltr">
                    {user.email}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-bold text-primary-700">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {!isStaffRole && !isAlreadyDriver && (
                  <button
                    onClick={() => {
                      setPromoteError(null);
                      setPromotingId(user.id);
                    }}
                    className="text-[11px] font-bold text-primary-700 underline"
                  >
                    إضافة كمندوب
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {data && data.items.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink/40">لا يوجد مستخدمين مطابقين</p>
        )}
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

      {promotingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-card">
            <h3 className="font-bold text-ink">تأكيد الترقية</h3>
            <p className="mt-2 text-sm text-ink/60">هل تريد ترقية هذا المستخدم إلى مندوب توصيل؟</p>
            {promoteError && <p className="mt-2 text-xs font-bold text-red-500">{promoteError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPromotingId(null)}
                className="flex-1 rounded-full bg-ink/5 py-2 text-sm font-bold text-ink/60"
              >
                إلغاء
              </button>
              <button
                onClick={() => promote.mutate(promotingId)}
                disabled={promote.isPending}
                className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {promote.isPending ? 'جارِ التنفيذ...' : 'تأكيد'}
              </button>
            </div>
          </div>
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
