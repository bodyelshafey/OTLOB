import Link from 'next/link';
import Image from 'next/image';
import { Star, Clock } from 'lucide-react';
import type { Store } from '@/types';

export function StoreCard({ store }: { store: Store }) {
  return (
    <Link
      href={`/stores/${store.id}`}
      className="block overflow-hidden rounded-xl2 bg-white shadow-soft transition-transform active:scale-[0.98]"
    >
      <div className="relative h-28 w-full bg-primary-100">
        {store.coverImage ? (
          <Image src={store.coverImage} alt={store.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl text-primary-700/40">
            {store.name.charAt(0)}
          </div>
        )}
        {!store.isOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">مغلق حاليًا</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate font-display font-bold text-ink">{store.name}</h3>
        <div className="mt-1 flex items-center gap-3 text-xs text-ink/60">
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
          <span className="mr-auto font-mono">{Number(store.deliveryFee) === 0 ? 'توصيل مجاني' : `${store.deliveryFee} ج.م`}</span>
        </div>
      </div>
    </Link>
  );
}
