'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Pencil, Power, Image as ImageIcon, ChevronDown } from 'lucide-react';
import NextImage from 'next/image';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { STORE_TABS } from '@/lib/dashboard-nav';
import type { Store, Offer } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600',
  APPROVED: 'bg-green-50 text-green-600',
  REJECTED: 'bg-red-50 text-red-500',
};

interface OfferFormState {
  id?: string;
  titleAr: string;
  titleEn: string;
  oldPrice: string;
  newPrice: string;
  discountPercentage: string;
  image: string;
  isFeaturedHome: boolean;
  descriptionAr: string;
  includedItems: string;
  conditions: string;
  quantityLimit: string;
}

const EMPTY_FORM: OfferFormState = {
  titleAr: '',
  titleEn: '',
  oldPrice: '',
  newPrice: '',
  discountPercentage: '',
  image: '',
  isFeaturedHome: false,
  descriptionAr: '',
  includedItems: '',
  conditions: '',
  quantityLimit: '',
};

function offerToForm(offer: Offer): OfferFormState {
  return {
    id: offer.id,
    titleAr: offer.titleAr,
    titleEn: offer.titleEn ?? '',
    oldPrice: offer.oldPrice != null ? String(offer.oldPrice) : '',
    newPrice: offer.newPrice != null ? String(offer.newPrice) : '',
    discountPercentage: offer.discountPercentage != null ? String(offer.discountPercentage) : '',
    image: offer.image ?? '',
    isFeaturedHome: !!offer.isFeaturedHome,
    descriptionAr: offer.descriptionAr ?? '',
    includedItems: offer.includedItems ?? '',
    conditions: offer.conditions ?? '',
    quantityLimit: offer.quantityLimit != null ? String(offer.quantityLimit) : '',
  };
}

// Any of these being filled in is what makes a "simple" offer into a
// "detailed" one — used only to decide whether the details section opens
// expanded by default when editing an existing offer.
function hasDetails(f: OfferFormState) {
  return !!(f.descriptionAr || f.includedItems || f.conditions || f.quantityLimit);
}

function OffersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfferFormState | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['my-store'],
    queryFn: () => api.get('/stores/mine').then((r) => r.data),
  });
  const store = stores?.[0];

  const { data: offers } = useQuery<Offer[]>({
    queryKey: ['store-offers', store?.id],
    queryFn: () => api.get('/offers/mine', { params: { storeId: store!.id } }).then((r) => r.data),
    enabled: !!store,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['store-offers', store?.id] });

  const savePayload = (payload: OfferFormState) => ({
    titleAr: payload.titleAr,
    titleEn: payload.titleEn || payload.titleAr,
    oldPrice: payload.oldPrice ? Number(payload.oldPrice) : undefined,
    newPrice: payload.newPrice ? Number(payload.newPrice) : undefined,
    discountPercentage: payload.discountPercentage ? Number(payload.discountPercentage) : undefined,
    image: payload.image || undefined,
    isFeaturedHome: payload.isFeaturedHome,
    // Fully optional — omitted (not sent as empty strings) when blank, so a
    // simple offer's payload looks exactly like it did before this section
    // existed.
    descriptionAr: payload.descriptionAr || undefined,
    includedItems: payload.includedItems || undefined,
    conditions: payload.conditions || undefined,
    quantityLimit: payload.quantityLimit ? Number(payload.quantityLimit) : undefined,
  });

  const createOffer = useMutation({
    mutationFn: (payload: OfferFormState) => api.post('/offers', { storeId: store!.id, ...savePayload(payload) }),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateOffer = useMutation({
    mutationFn: (payload: OfferFormState) => api.patch(`/offers/${payload.id}`, savePayload(payload)),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const removeOffer = useMutation({
    mutationFn: (id: string) => api.delete(`/offers/${id}`),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/offers/${id}/toggle-active`),
    onSuccess: invalidate,
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'offers');
      // Don't set Content-Type manually — axios needs to generate it itself
      // (including the multipart boundary) when the body is a FormData
      // instance. A hardcoded header here has no boundary, so the backend
      // can't parse the body and the upload fails with "No file provided".
      const { data } = await api.post<{ url: string }>('/upload/image', fd);
      setForm({ ...form, image: data.url });
    } finally {
      setUploading(false);
    }
  };

  if (!store) return null;

  return (
    <DashboardShell title="لوحة المتجر" tabs={STORE_TABS}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">العروض</h1>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setDetailsOpen(false);
          }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          عرض جديد
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(offers ?? []).map((offer) => (
          <div key={offer.id} className="flex items-center justify-between gap-2 rounded-xl2 bg-white p-4 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                {offer.image ? (
                  <NextImage src={offer.image} alt={offer.titleAr} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-700/30">
                    <ImageIcon size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="truncate font-bold text-ink">{offer.titleAr}</h4>
                {offer.newPrice != null && (
                  <p className="font-mono text-sm text-primary-700">
                    <span className="text-ink/40 line-through">{offer.oldPrice}</span> {offer.newPrice} ج.م
                  </p>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      offer.isActive ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    {offer.isActive ? 'مفعّل' : 'متوقف'}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      offer.isFeaturedHome ? 'bg-primary-50 text-primary-700' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    {offer.isFeaturedHome ? 'مميّز (هوم)' : 'عرض عادي'}
                  </span>
                  {offer.isFeaturedHome && offer.approvalStatus && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[offer.approvalStatus]}`}
                    >
                      {STATUS_LABEL[offer.approvalStatus]}
                    </span>
                  )}
                </div>
                {offer.isFeaturedHome && offer.approvalStatus === 'REJECTED' && offer.rejectionReason && (
                  <p className="mt-0.5 text-[10px] text-red-500">سبب الرفض: {offer.rejectionReason}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => toggleActive.mutate(offer.id)}
                title={offer.isActive ? 'إيقاف العرض' : 'تفعيل العرض'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => {
                  setForm(offerToForm(offer));
                  setDetailsOpen(hasDetails(offerToForm(offer)));
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => removeOffer.mutate(offer.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {offers?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد عروض حاليًا</p>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-soft lg:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-ink">{form.id ? 'تعديل العرض' : 'عرض جديد'}</h2>
              <button onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.id) updateOffer.mutate(form);
                else createOffer.mutate(form);
              }}
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-xl2 bg-primary-50 p-2.5 text-sm">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                  {form.image ? (
                    <NextImage src={form.image} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary-700/30">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <span className="text-ink/60">{uploading ? 'جارِ الرفع...' : 'اختر صورة العرض'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <input
                required
                placeholder="عنوان العرض"
                value={form.titleAr}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="السعر قبل"
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
                <input
                  type="number"
                  placeholder="السعر بعد"
                  value={form.newPrice}
                  onChange={(e) => setForm({ ...form, newPrice: e.target.value })}
                  className="w-1/2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <input
                type="number"
                placeholder="نسبة الخصم % (اختياري)"
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
                className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
              />
              <label className="flex items-center gap-2 rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.isFeaturedHome}
                  onChange={(e) => setForm({ ...form, isFeaturedHome: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-ink/70">اطلب ظهور العرض في قسم &quot;عروض اليوم&quot; بالصفحة الرئيسية</span>
              </label>
              {form.isFeaturedHome && (
                <p className="rounded-xl2 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  هذا الطلب يحتاج موافقة الإدارة أولًا قبل أن يظهر في الصفحة الرئيسية.
                </p>
              )}

              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                className="flex items-center justify-between rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm text-ink/70"
              >
                <span>تفاصيل إضافية (اختياري)</span>
                <ChevronDown size={16} className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </button>
              {detailsOpen && (
                <div className="flex flex-col gap-2 rounded-xl2 border border-dashed border-primary-100 p-3">
                  <p className="text-[11px] text-ink/40">
                    كل الحقول دي اختيارية تمامًا — تقدر تحفظ العرض من غيرها خالص.
                  </p>
                  <textarea
                    placeholder="وصف تفصيلي للعرض (اختياري)"
                    value={form.descriptionAr}
                    onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                    rows={2}
                    className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                  />
                  <textarea
                    placeholder="المنتجات/العناصر المتضمنة في العرض (اختياري)"
                    value={form.includedItems}
                    onChange={(e) => setForm({ ...form, includedItems: e.target.value })}
                    rows={2}
                    className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                  />
                  <textarea
                    placeholder="شروط أو ملاحظات على العرض (اختياري)"
                    value={form.conditions}
                    onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                    rows={2}
                    className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="أقصى عدد مرات استخدام (اختياري)"
                    value={form.quantityLimit}
                    onChange={(e) => setForm({ ...form, quantityLimit: e.target.value })}
                    className="rounded-xl2 bg-primary-50 px-4 py-2.5 text-sm outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={createOffer.isPending || updateOffer.isPending || uploading}
                className="mt-1 rounded-full bg-primary py-3 font-bold text-white disabled:opacity-50"
              >
                {createOffer.isPending || updateOffer.isPending ? 'جارِ الحفظ...' : 'حفظ العرض'}
              </button>
              {(createOffer.isError || updateOffer.isError) && (
                <p className="text-center text-xs text-red-500">
                  {getErrorMessage(createOffer.error ?? updateOffer.error, 'حدث خطأ أثناء الحفظ، حاول مرة أخرى')}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function StoreOffersPage() {
  return (
    <RoleGate allow={['STORE_OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <OffersManager />
    </RoleGate>
  );
}
