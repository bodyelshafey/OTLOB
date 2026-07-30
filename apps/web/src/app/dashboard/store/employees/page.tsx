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
  const [role, setRole] = useState('CASHIER');

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

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/stores/${store!.id}/employees/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', store?.id] }),
  });

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-ink">الموظفين</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus size={14} />
            إضافة موظف
          </button>
        </div>

        <p className="mt-2 text-xs text-ink/40">
          اطلب من الموظف يعمل حساب مستخدم عادي الأول، وبعدين انسخ الـ ID بتاعه من صفحة حسابه وضيفه هنا.
        </p>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (userId.trim()) addMember.mutate();
            }}
            className="mt-3 flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft lg:max-w-md"
          >
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
              <option value="CASHIER">كاشير</option>
              <option value="MANAGER">مدير فرع</option>
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
