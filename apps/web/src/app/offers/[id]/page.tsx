'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ListChecks, Info, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart-store';
import type { Offer } from '@/types';

export default function OfferDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addOffer = useCartStore((s) => s.addOffer);

  const { data: offer } = useQuery<Offer>({
    queryKey: ['offer', id],
    queryFn: () => api.get(`/offers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (!offer) return null;

  const storeId = offer.storeId ?? offer.store?.id;

  return (
    <div className="pb-24">
      <div className="relative h-52 w-full bg-primary-100">
        {offer.image && <Image src={offer.image} alt={offer.titleAr} fill className="object-cover" />}
        <button
          onClick={() => router.back()}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft"
          aria-label="رجوع"
        >
          <ArrowRight size={18} />
        </button>
        {offer.discountPercentage != null && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
            خصم {offer.discountPercentage}%
          </span>
        )}
      </div>

      <div className="px-4 pt-4">
        <h1 className="font-display text-xl font-extrabold text-ink">{offer.titleAr}</h1>

        {offer.store?.name && storeId && (
          <Link
            href={`/stores/${storeId}`}
            className="mt-3 flex items-center gap-3 rounded-xl2 bg-white p-2.5 shadow-soft"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary-100">
              {offer.store.image ? (
                <Image src={offer.store.image} alt={offer.store.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-sm text-primary-700">
                  {offer.store.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink">{offer.store.name}</p>
              <p className="text-xs text-primary-700">زيارة المتجر</p>
            </div>
          </Link>
        )}

        {offer.descriptionAr && <p className="mt-4 text-sm leading-6 text-ink/60">{offer.descriptionAr}</p>}

        {/* Optional detailed fields — only render when the owner actually filled them in. */}
        {offer.includedItems && (
          <div className="mt-4">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
              <ListChecks size={14} className="text-primary-700" />
              يشمل العرض
            </h2>
            <p className="whitespace-pre-line text-sm text-ink/60">{offer.includedItems}</p>
          </div>
        )}
        {offer.conditions && (
          <div className="mt-4">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Ban size={14} className="text-primary-700" />
              شروط العرض
            </h2>
            <p className="whitespace-pre-line text-sm text-ink/60">{offer.conditions}</p>
          </div>
        )}
        {offer.quantityLimit != null && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink/40">
            <Info size={13} />
            أقصى عدد مرات استخدام للعرض: {offer.quantityLimit}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2">
          {offer.newPrice != null && (
            <span className="font-mono text-xl font-bold text-primary-700">{offer.newPrice} ج.م</span>
          )}
          {offer.oldPrice != null && (
            <span className="font-mono text-sm text-ink/40 line-through">{offer.oldPrice} ج.م</span>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-white p-4 m-14">
        <button
          onClick={() => addOffer(offer)}
          disabled={offer.isActive === false}
          className="w-full rounded-full bg-primary py-3 font-bold text-white shadow-card transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {offer.isActive === false ? 'العرض غير متاح حاليًا' : 'أضف للسلة'}
        </button>
      </div>
    </div>
  );
}
