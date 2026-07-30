'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { StoreCard } from '@/components/StoreCard';
import type { Store, StoreType } from '@/types';

export default function HomePage() {
  const t = useTranslations('common');
  const { data: storeTypes } = useQuery<StoreType[]>({
    queryKey: ['store-types'],
    queryFn: () => api.get('/store-types').then((r) => r.data),
  });

  const { data: storesRes } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', 'home'],
    queryFn: () => api.get('/stores?limit=10').then((r) => r.data),
  });

  const { data: offers } = useQuery<any[]>({
    queryKey: ['offers', 'home'],
    queryFn: () => api.get('/offers').then((r) => r.data),
  });

  return (
    <div className="pb-4">
      {/* Search */}
      <div className="px-4 pt-4">
        <Link
          href="/stores"
          className="flex items-center gap-2 rounded-xl2 bg-white px-4 py-3 text-ink/40 shadow-soft"
        >
          <Search size={18} />
          <span className="text-sm">{t('searchPlaceholder')}</span>
        </Link>
      </div>

      {/* Categories */}
      <section className="mt-5">
        <div className="flex items-center justify-between px-4">
          <h2 className="font-display font-bold text-ink">{t('browseByType')}</h2>
        </div>
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
          {(storeTypes ?? []).map((type) => (
            <Link
              key={type.id}
              href={`/stores?storeTypeId=${type.id}`}
              className="flex w-20 shrink-0 flex-col items-center gap-2"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-soft">
                {type.image ? (
                  <Image src={type.image} alt={type.nameAr} width={36} height={36} />
                ) : (
                  <span className="font-display text-xl text-primary-700">{type.nameAr.charAt(0)}</span>
                )}
              </div>
              <span className="text-center text-xs font-medium text-ink/70">{type.nameAr}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Offers */}
      {offers && offers.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="font-display font-bold text-ink">{t('todayOffers')}</h2>
          </div>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="relative h-32 w-56 shrink-0 overflow-hidden rounded-xl2 bg-gradient-to-br from-primary to-primary-700 p-4 text-white shadow-card"
              >
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold">
                  خصم {offer.discountPercentage ?? ''}%
                </span>
                <h3 className="mt-2 font-display font-bold">{offer.titleAr}</h3>
                {offer.newPrice && (
                  <p className="mt-1 font-mono text-sm">
                    <span className="opacity-60 line-through">{offer.oldPrice}</span>{' '}
                    <span className="font-bold">{offer.newPrice} ج.م</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nearby stores */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-ink">{t('nearbyStores')}</h2>
          <Link href="/stores" className="text-xs font-medium text-primary-700">
            {t('seeAll')}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(storesRes?.items ?? []).map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
          {storesRes?.items?.length === 0 && (
            <p className="py-8 text-center text-sm text-ink/40 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              لا توجد متاجر متاحة حاليًا
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
