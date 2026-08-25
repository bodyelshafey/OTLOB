'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Offer } from '@/types';

export default function OffersPage() {
  const { data: offers } = useQuery<Offer[]>({
    queryKey: ['offers', 'all'],
    queryFn: () => api.get('/offers').then((r) => r.data),
  });

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="font-display text-lg font-bold text-ink">كل العروض</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(offers ?? []).map((offer) => (
          <Link
            key={offer.id}
            href={`/offers/${offer.id}`}
            className="block overflow-hidden rounded-xl2 bg-white shadow-soft transition-transform active:scale-[0.98]"
          >
            <div className="relative h-24 w-full bg-primary-100">
              {offer.image ? (
                <Image src={offer.image} alt={offer.titleAr} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-xl text-primary-700/40">
                  {offer.titleAr.charAt(0)}
                </div>
              )}
              {offer.discountPercentage != null && (
                <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                  خصم {offer.discountPercentage}%
                </span>
              )}
            </div>
            <div className="p-2.5">
              <h3 className="truncate font-bold text-ink">{offer.titleAr}</h3>
              {offer.store?.name && (
                <p className="truncate text-xs text-ink/50">{offer.store.name}</p>
              )}
              {offer.newPrice != null && (
                <p className="mt-1 font-mono text-sm font-bold text-primary-700">{offer.newPrice} ج.م</p>
              )}
            </div>
          </Link>
        ))}
        {offers?.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-ink/40">لا توجد عروض متاحة حاليًا</p>
        )}
      </div>
    </div>
  );
}
