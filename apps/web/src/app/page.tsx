'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { StoreCard } from '@/components/StoreCard';
import { AdsCarousel } from '@/components/AdsCarousel';
import { BackgroundDecor } from '@/components/decor/BackgroundDecor';
import type { Store, StoreType, Offer, Banner } from '@/types';

export default function HomePage() {
  const t = useTranslations('common');
  const { data: storeTypes } = useQuery<StoreType[]>({
    queryKey: ['store-types'],
    queryFn: () => api.get('/store-types').then((r) => r.data),
    // Category list barely ever changes — cache it client-side so repeat
    // visits render the (now heavier, image-based) category row instantly
    // instead of re-fetching every time.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: storesRes } = useQuery<{ items: Store[] }>({
    queryKey: ['stores', 'home'],
    queryFn: () => api.get('/stores?limit=10').then((r) => r.data),
  });

  const { data: offers } = useQuery<Offer[]>({
    queryKey: ['offers', 'home'],
    // Homepage "Today's Offers" — only offers a store owner marked as
    // featured AND an admin approved. The general "all offers" page
    // (/offers) intentionally still calls the endpoint without this flag.
    queryFn: () => api.get('/offers?home=true').then((r) => r.data),
  });

  const { data: banners } = useQuery<Banner[]>({
    queryKey: ['banners', 'home'],
    queryFn: () => api.get('/banners').then((r) => r.data),
  });

  return (
    <div className="relative overflow-hidden pb-4 -mt-0">
      <BackgroundDecor />
      {/* Tagline + search — one white card overlapping the header's wave,
          matching the reference layout */}
      <div className="relative -mt-0 px-2 ">
        <div className="rounded-2xl bg-white p-4 shadow-soft -mt-0 ">
          <h1 className="font-display text-2xl font-extrabold text-ink">{t('tagline')}</h1>
          <Link
            href="/stores"
            className="mt-3 flex items-center gap-2 rounded-xl2 bg-primary-50 px-4 py-3 text-ink/40"
          >
            <Search size={18} />
            <span className="text-sm">{t('searchPlaceholder')}</span>
          </Link>
        </div>
      </div>

      {/* Categories — visual, image-led cards (was icon-in-square before) */}
      <section className="relative mt-5">
        <div className="flex items-center justify-between px-4">
          <h2 className="font-display font-bold text-ink">{t('browseByType')}</h2>
        </div>
        <div className="no-scrollbar mt-3 flex gap-4 overflow-x-auto px-4 pb-1">
          {(storeTypes ?? []).map((type) => (
            <Link
              key={type.id}
              href={`/stores?storeTypeId=${type.id}`}
              className="flex w-20 shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
            >
              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-white shadow-soft ring-1 ring-primary-100">
                {type.image ? (
                  <Image src={type.image} alt={type.nameAr} width={72} height={72} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-2xl text-primary-700">{type.nameAr.charAt(0)}</span>
                )}
              </div>
              <span className="text-center text-xs font-medium text-ink/70">{type.nameAr}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Ads / banners */}
      {banners && banners.length > 0 && (
        <section className="mt-5">
          <AdsCarousel items={banners} />
        </section>
      )}

      {/* Offers */}
      {offers && offers.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="font-display font-bold text-ink">{t('todayOffers')}</h2>
            <Link href="/offers" className="text-xs font-medium text-primary-700">
              {t('seeAll')}
            </Link>
          </div>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {offers.map((offer) => (
              <Link
                key={offer.id}
                href={`/offers/${offer.id}`}
                className="relative h-32 w-56 shrink-0 overflow-hidden rounded-xl2 bg-gradient-to-br from-primary to-primary-700 p-4 text-white shadow-card transition-transform active:scale-[0.98]"
              >
                {offer.image && (
                  <Image
                    src={offer.image}
                    alt={offer.titleAr}
                    fill
                    className="object-cover opacity-35"
                  />
                )}
                <div className="relative">
                  {offer.discountPercentage != null && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold">
                      خصم {offer.discountPercentage}%
                    </span>
                  )}
                  <h3 className="mt-2 truncate font-display font-bold">{offer.titleAr}</h3>
                  {offer.store?.name && (
                    <p className="truncate text-xs opacity-80">{offer.store.name}</p>
                  )}
                  {offer.newPrice != null && (
                    <p className="mt-1 font-mono text-sm">
                      {offer.oldPrice != null && (
                        <span className="opacity-60 line-through">{offer.oldPrice}</span>
                      )}{' '}
                      <span className="font-bold">{offer.newPrice} ج.م</span>
                    </p>
                  )}
                </div>
              </Link>
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
