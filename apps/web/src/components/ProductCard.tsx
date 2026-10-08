'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { Product } from '@/types';
import { useCartStore } from '@/store/cart-store';

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <div className="flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-50">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-primary-700/40">صورة</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-bold text-ink">{product.name}</h4>
        {product.description && (
          <p className="mt-0.5 truncate text-xs text-ink/50">{product.description}</p>
        )}
        <p className="mt-1 font-mono font-bold text-primary-700">{product.price} ج.م</p>
      </div>
      <button
        onClick={() => addItem(product)}
        disabled={!product.isAvailable}
        aria-label={`أضف ${product.name} إلى السلة`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-card transition-transform active:scale-90 disabled:bg-ink/20"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
