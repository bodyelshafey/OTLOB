'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, storeId, subtotal, clear } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) router.push('/login?redirect=/checkout');
  }, [accessToken, router]);

  const [customerName, setCustomerName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [fullAddress, setFullAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [error, setError] = useState<string | null>(null);

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('السلة فارغة');

      // Sync the local cart into the backend cart, then submit checkout in one shot.
      await api.delete('/cart');
      for (const line of lines) {
        await api.post('/cart', { productId: line.product.id, quantity: line.quantity });
      }

      const { data } = await api.post('/orders', {
        storeId,
        customerName,
        phone,
        fullAddress,
        paymentMethod,
      });
      return data;
    },
    onSuccess: (order) => {
      clear();
      router.push(`/profile/orders?justPlaced=${order.id}`);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'حدث خطأ أثناء إتمام الطلب، حاول مرة أخرى');
    },
  });

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-xl">
      <h1 className="font-display text-lg font-bold text-ink">إتمام الطلب</h1>

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          placeOrder.mutate();
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">الاسم</label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">رقم الهاتف</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
            dir="ltr"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">العنوان بالتفصيل</label>
          <textarea
            required
            value={fullAddress}
            onChange={(e) => setFullAddress(e.target.value)}
            rows={3}
            placeholder="الحي، المبنى، الدور، رقم الشقة..."
            className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">طريقة الدفع</label>
          <div className="flex gap-2">
            {(['CASH', 'CARD'] as const).map((method) => (
              <button
                type="button"
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 rounded-xl2 py-2.5 text-sm font-bold transition-colors ${
                  paymentMethod === method ? 'bg-primary text-white' : 'bg-white text-ink/60 shadow-soft'
                }`}
              >
                {method === 'CASH' ? 'كاش عند الاستلام' : 'بطاقة ائتمان'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-xl2 bg-white p-4 shadow-soft">
          <div className="flex justify-between text-sm">
            <span className="text-ink/60">الإجمالي الفرعي</span>
            <span className="font-mono font-bold">{subtotal()} ج.م</span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={placeOrder.isPending || lines.length === 0}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {placeOrder.isPending ? 'جارِ إرسال الطلب...' : 'تأكيد الطلب'}
        </button>
      </form>
    </div>
  );
}
