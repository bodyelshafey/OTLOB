'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [fullAddress, setFullAddress] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: addresses } = useQuery<any[]>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/addresses').then((r) => r.data),
  });

  const { data: districts } = useQuery<any[]>({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then((r) => r.data).catch(() => []),
  });

  const create = useMutation({
    mutationFn: (payload: { districtId: string; fullAddress: string }) =>
      api.post('/addresses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setFullAddress('');
      setShowForm(false);
    },
  });

  const [districtId, setDistrictId] = useState('');

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">عناويني</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          إضافة عنوان
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (districtId && fullAddress) create.mutate({ districtId, fullAddress });
            }}
            className="flex flex-col gap-2 rounded-xl2 bg-white p-4 shadow-soft"
          >
            <select
              required
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">اختر الحي</option>
              {(districts ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameAr}
                </option>
              ))}
            </select>
            <textarea
              required
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              placeholder="تفاصيل العنوان (المبنى، الدور، الشقة)"
              rows={2}
              className="rounded-xl bg-primary-50 px-3 py-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-full bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {create.isPending ? 'جارِ الحفظ...' : 'حفظ العنوان'}
            </button>
          </form>
        )}

        {(addresses ?? []).map((addr) => (
          <div key={addr.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <div>
              <p className="text-sm font-medium text-ink">{addr.fullAddress}</p>
              {addr.district && <p className="text-xs text-ink/40">{addr.district.nameAr}</p>}
            </div>
            <button onClick={() => remove.mutate(addr.id)} className="text-ink/30">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {addresses?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لا توجد عناوين محفوظة بعد</p>
        )}
      </div>
    </div>
  );
}
