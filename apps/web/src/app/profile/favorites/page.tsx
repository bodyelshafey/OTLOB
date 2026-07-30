'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Star } from 'lucide-react';
import { api } from '@/lib/api';

export default function FavoritesPage() {
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery<any[]>({
    queryKey: ['favorites'],
    queryFn: () => api.get('/favorites').then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/favorites/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-2xl">
      <h1 className="font-display text-lg font-bold text-ink">المفضلة</h1>

      {isLoading && <p className="py-8 text-center text-sm text-ink/40">جارِ التحميل...</p>}

      <div className="mt-3 flex flex-col gap-2">
        {(favorites ?? []).map((fav) => (
          <div key={fav.id} className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft">
            <Link href={fav.store ? `/stores/${fav.store.id}` : '#'} className="flex-1">
              <p className="font-bold text-ink">{fav.store?.name ?? fav.product?.name}</p>
              {fav.store && (
                <span className="flex items-center gap-1 text-xs text-ink/50">
                  <Star size={12} className="fill-accent text-accent" />
                  {Number(fav.store.rating).toFixed(1)}
                </span>
              )}
            </Link>
            <button onClick={() => remove.mutate(fav.id)}>
              <Heart size={18} className="fill-accent text-accent" />
            </button>
          </div>
        ))}
        {!isLoading && favorites?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">مفيش حاجة في المفضلة لسه</p>
        )}
      </div>
    </div>
  );
}
