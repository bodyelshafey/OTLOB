'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Store, ClipboardList, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('common');

  const items = [
    { href: '/', label: t('navHome'), icon: Home },
    { href: '/stores', label: t('navStores'), icon: Store },
    { href: '/profile/orders', label: t('navOrders'), icon: ClipboardList },
    { href: '/profile', label: t('navProfile'), icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-primary-100 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                active ? 'text-primary-700' : 'text-ink/40',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
