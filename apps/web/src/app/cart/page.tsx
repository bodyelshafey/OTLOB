'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore, lineId, lineName, lineImage, linePrice } from '@/store/cart-store';

export default function CartPage() {
  const router = useRouter();
  const { lines, updateQuantity, removeItem, subtotal } = useCartStore();

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <ShoppingBag size={40} className="text-primary-700/30" />
        <p className="font-display font-bold text-ink">سلتك فارغة</p>
        <p className="text-sm text-ink/50">تصفح المتاجر وأضف أول طلب ليك</p>
        <Link href="/stores" className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white">
          تصفح المتاجر
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-2xl">
      <h1 className="font-display text-lg font-bold text-ink">سلة الطلبات</h1>
      <div className="mt-3 flex flex-col gap-3">
        {lines.map((line) => {
          const id = lineId(line);
          const image = lineImage(line);
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary-50">
                {image && <Image src={image} alt={lineName(line)} fill className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="truncate font-bold text-ink">{lineName(line)}</h4>
                  {line.offer && (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white">
                      عرض
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm text-primary-700">{linePrice(line)} ج.م</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary-50 px-2 py-1">
                <button onClick={() => updateQuantity(id, line.quantity - 1)}>
                  <Minus size={14} />
                </button>
                <span className="w-4 text-center font-mono text-sm">{line.quantity}</span>
                <button onClick={() => updateQuantity(id, line.quantity + 1)}>
                  <Plus size={14} />
                </button>
              </div>
              <button onClick={() => removeItem(id)} className="text-ink/30">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl2 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink/60">الإجمالي الفرعي</span>
          <span className="font-mono font-bold">{subtotal()} ج.م</span>
        </div>
        <p className="mt-1 text-xs text-ink/40">سيتم إضافة رسوم التوصيل عند اتمام الطلب</p>
        <button
          onClick={() => router.push('/checkout')}
          className="mt-4 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card transition-transform active:scale-[0.98]"
        >
          متابعة إتمام الطلب
        </button>
      </div>
    </div>
  );
}
