'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Clock, Truck } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import type { Store, Category, Product } from '@/types';

export default function StoreDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: store } = useQuery<Store>({
    queryKey: ['store', id],
    queryFn: () => api.get(`/stores/${id}`).then((r) => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', id],
    queryFn: () => api.get('/categories', { params: { storeId: id } }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: productsRes } = useQuery<{ items: Product[] }>({
    queryKey: ['products', id, activeCategory],
    queryFn: () =>
      api
        .get('/products', { params: { storeId: id, categoryId: activeCategory ?? undefined, limit: 100 } })
        .then((r) => r.data),
    enabled: !!id,
  });

  if (!store) return null;

  return (
    <div className="pb-4">
      <div className="relative h-40 w-full bg-primary-100">
        {store.coverImage && <Image src={store.coverImage} alt={store.name} fill className="object-cover" />}
      </div>

      <div className="rounded-t-2xl -mt-4 relative bg-primary-50 px-4 pt-4">
        <h1 className="font-display text-xl font-extrabold text-ink">{store.name}</h1>
        {store.description && <p className="mt-1 text-sm text-ink/60">{store.description}</p>}
        <div className="mt-2 flex items-center gap-4 text-xs text-ink/60">
          <span className="flex items-center gap-1">
            <Star size={13} className="fill-accent text-accent" />
            {Number(store.rating).toFixed(1)}
          </span>
          {store.deliveryTime && (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {store.deliveryTime}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Truck size={13} />
            {Number(store.deliveryFee) === 0 ? 'مجاني' : `${store.deliveryFee} ج.م`}
          </span>
        </div>
        {!store.isOpen && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500">
            المتجر مغلق حاليًا، لن تتمكن من تقديم طلب الآن
          </p>
        )}
      </div>

      {/* Category tabs */}
      <div className="no-scrollbar sticky top-14 z-30 flex gap-2 overflow-x-auto bg-primary-50 px-4 py-3">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx(
            'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
            activeCategory === null ? 'bg-primary text-white' : 'bg-white text-ink/60',
          )}
        >
          الكل
        </button>
        {(categories ?? []).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={clsx(
              'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              activeCategory === cat.id ? 'bg-primary text-white' : 'bg-white text-ink/60',
            )}
          >
            {cat.nameAr}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 xl:grid-cols-3">
        {(productsRes?.items ?? []).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {productsRes?.items?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 xl:col-span-3">لا توجد منتجات في هذا القسم</p>
        )}
      </div>
    </div>
  );
}
