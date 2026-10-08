'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'مدير فرع',
  CASHIER: 'كاشير',
  OWNER: 'مالك',
};

function EmployeesManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [showCashierForm, setShowCashierForm] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [cashierUsername, setCashierUsername] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [cashierError, setCashierError] = useState<string | null>(null);

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: members } = useQuery<any[]>({
    queryKey: ['employees', store?.id],
    queryFn: () => api.get(`/stores/${store!.id}/employees`).then((r) => r.data),
    enabled: !!store,
  });

  const addMember = useMutation({
    mutationFn: () => api.post(`/stores/${store!.id}/employees`, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', store?.id] });
      setUserId('');
      setShowForm(false);
    },
  });

  // The direct cashier-creation flow (Phase 6, 2026-09-13) — replaces the
  // old "ask them to self-register, then paste their user ID" approach for
  // this specific role: the owner picks a username + temporary password
  // and the account is created directly, store-scoped, with no
  // self-registration window at all.
  const addCashier = useMutation({
    mutationFn: () =>
      api.post(`/stores/${store!.id}/employees/cashiers`, {
        fullName: cashierName,
        username: cashierUsername,
        password: cashierPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', store?.id] });
      setCashierName('');
      setCashierUsername('');
      setCashierPassword('');
      setShowCashierForm(false);
      setCashierError(null);
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      setCashierError(
        body?.code === 'USERNAME_ALREADY_EXISTS' ? 'اسم المستخدم ده مستخدم بالفعل.' : body?.message ?? 'تعذر إضافة الكاشير',
      );
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/stores/${store!.id}/employees/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', store?.id] }),
  });

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-ink">الموظفين والكاشير</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowCashierForm((v) => !v);
                setShowForm(false);
              }}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus size={14} />
              إضافة كاشير
            </button>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setShowCashierForm(false);
              }}
              className="flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold text-ink/60"
            >
              <Plus size={14} />
              ربط مدير فرع
            </button>
          </div>
        </div>

        {showCashierForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCashier.mutate();
            }}
            className="mt-3 flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
          >
            <input
              required
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              placeholder="اسم الكاشير"
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <input
              required
              value={cashierUsername}
              onChange={(e) => {
                setCashierUsername(e.target.value);
                setCashierError(null);
              }}
              placeholder="اسم المستخدم (username)"
              dir="ltr"
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <input
              required
              type="password"
              minLength={8}
              value={cashierPassword}
              onChange={(e) => setCashierPassword(e.target.value)}
              placeholder="كلمة مرور مؤقتة (٨ أحرف على الأقل)"
              dir="ltr"
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            {cashierError && <p className="text-xs font-bold text-red-500">{cashierError}</p>}
            <button
              type="submit"
              disabled={addCashier.isPending}
              className="rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {addCashier.isPending ? 'جارِ الإضافة...' : 'إضافة الكاشير'}
            </button>
          </form>
        )}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (userId.trim()) addMember.mutate();
            }}
            className="mt-3 flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
          >
            <p className="text-xs text-ink/40">
              لربط مدير فرع عنده حساب مستخدم بالفعل — الصق الـ ID بتاعه هنا.
            </p>
            <input
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="معرّف المستخدم (User ID)"
              dir="ltr"
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            >
              <option value="MANAGER">مدير فرع</option>
              <option value="CASHIER">كاشير</option>
            </select>
            <button
              type="submit"
              disabled={addMember.isPending}
              className="rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {addMember.isPending ? 'جارِ الإضافة...' : 'إضافة'}
            </button>
          </form>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(members ?? []).map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
              <div>
                <h4 className="font-bold text-ink">{member.user?.fullName}</h4>
                <p className="text-xs text-ink/40" dir="ltr">
                  {member.user?.username ?? member.user?.phone ?? member.user?.email}
                </p>
                <p className="text-xs text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</p>
              </div>
              <button
                onClick={() => removeMember.mutate(member.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {members?.length === 0 && (
            <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا يوجد موظفين بعد</p>
          )}
        </div>
    </DashboardShell>
  );
}

export default function StoreEmployeesPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <EmployeesManager />
    </RoleGate>
  );
}
