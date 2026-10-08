'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MapPin, Home, Store, ClipboardList, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { useCartStore } from '@/store/cart-store';
import { LocaleToggle } from './LocaleToggle';
import { NavbarWave } from './decor/NavbarWave';
import { HangingDecorations } from './decor/HangingDecorations';

export function Header() {
  const lines = useCartStore((s) => s.lines);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const t = useTranslations('common');
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: t('navHome'), icon: Home },
    { href: '/stores', label: t('navStores'), icon: Store },
    { href: '/profile/orders', label: t('navOrders'), icon: ClipboardList },
    { href: '/profile', label: t('navProfile'), icon: User },
  ];

  return (
    <header
  className="sticky top-0 z-40 relative"
  style={{
    background: '#12bfe5',
    paddingBottom: '15px',
  }}
>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span style={{color:'#fff',fontFamily:'cyberjunkies',fontSize: 'clamp(26px,4vw,42px)'}}>{t('brand')}</span>
        </Link>

        {/* Desktop / tablet nav — the bottom nav takes over this role on small screens */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors',
                  active ? 'bg-primary-50 text-primary-700' : 'text-ink/50 hover:text-ink/80',
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button className="hidden items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-xs text-primary-700 sm:flex">
            <MapPin size={14} />
            <span>{t('location')}</span>
          </button>
          <LocaleToggle />
          <Link
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl2 bg-primary-50 text-primary-700"
          >
            <ShoppingBag size={18} />
            {itemCount > 0 && (
              <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      {/* Decorative wave + hanging decorations */}
<div className="absolute left-0 right-0 bottom-0 translate-y-[1px] pointer-events-none">
  <NavbarWave className="h-20 w-full text-primary-100" />
  <HangingDecorations />
</div>
    </header>
  );
}
