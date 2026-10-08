'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface DashboardNavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * Shared shell for the store/driver/admin dashboards.
 * - Mobile: horizontal scrolling pill tabs above the content (original layout).
 * - Desktop (lg+): a persistent left sidebar next to a wider content area,
 *   so dashboards actually use the screen instead of stretching a phone
 *   layout across a monitor.
 */
export function DashboardShell({
  title,
  tabs,
  children,
}: {
  title: string;
  tabs: DashboardNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="lg:flex lg:gap-6 lg:px-8 lg:py-6">
      {/* Mobile pill tabs */}
      <div className="no-scrollbar sticky top-14 z-30 flex gap-2 overflow-x-auto bg-primary-50 px-4 py-3 lg:hidden">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                active ? 'bg-primary text-white' : 'bg-white text-ink/60',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 lg:block lg:w-56">
        <div className="sticky top-24 rounded-xl2 bg-white p-3 shadow-soft">
          <h2 className="px-3 pb-2 pt-1 font-display text-sm font-bold text-ink/70">{title}</h2>
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors',
                    active ? 'bg-primary-50 text-primary-700' : 'text-ink/60 hover:bg-primary-50/50',
                  )}
                >
                  {Icon && <Icon size={16} />}
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-4 pt-3 lg:px-0 lg:pt-0">{children}</div>
    </div>
  );
}
