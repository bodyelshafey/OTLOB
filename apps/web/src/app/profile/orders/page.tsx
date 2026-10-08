'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock3, Truck, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useLiveOrderStatuses } from '@/lib/socket';
import type { Order, OrderStatus } from '@/types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'بانتظار تأكيد المتجر',
  ACCEPTED: 'تم تأكيد الطلب',
  PREPARING: 'جارِ التحضير',
  READY: 'جاهز للتوصيل',
  DELIVERING: 'في الطريق إليك',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={16} className="text-green-500" />;
  if (status === 'CANCELLED') return <XCircle size={16} className="text-red-500" />;
  if (status === 'DELIVERING') return <Truck size={16} className="text-primary-700" />;
  return <Clock3 size={16} className="text-accent" />;
}

export default function MyOrdersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get('justPlaced');

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/me').then((r) => r.data),
    enabled: !!accessToken,
  });

  const liveStatuses = useLiveOrderStatuses();

  if (!accessToken) {
    return <p className="px-4 py-10 text-center text-sm text-ink/50">سجّل دخولك لعرض طلباتك</p>;
  }

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-2xl">
      <h1 className="font-display text-lg font-bold text-ink">طلباتي</h1>

      {justPlaced && (
        <p className="mt-3 rounded-xl2 bg-green-50 px-4 py-3 text-sm font-bold text-green-600">
          تم استلام طلبك بنجاح! هيتم تجهيزه في أقرب وقت.
        </p>
      )}

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 flex flex-col gap-3">
        {(orders ?? []).map((order) => {
          const liveStatus = (liveStatuses[order.id] as OrderStatus) ?? order.orderStatus;
          return (
            <div key={order.id} className="rounded-xl2 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">{order.store?.name ?? 'طلب'}</h3>
                <span className="flex items-center gap-1 text-xs font-bold text-ink/60">
                  <StatusIcon status={liveStatus} />
                  {STATUS_LABELS[liveStatus]}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/40">
                {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div className="mt-2 flex justify-between border-t border-primary-50 pt-2 text-sm">
                <span className="text-ink/60">{order.items?.length ?? 0} عناصر</span>
                <span className="font-mono font-bold text-primary-700">{order.total} ج.م</span>
              </div>
            </div>
          );
        })}
        {!isLoading && orders?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">لسه معملتش أي طلب</p>
        )}
      </div>
    </div>
  );
}
