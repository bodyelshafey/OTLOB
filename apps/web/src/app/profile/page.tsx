'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, MapPin, Heart, ClipboardList, ChevronLeft, LayoutDashboard, Pencil } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

const DASHBOARD_PATH_BY_ROLE: Record<string, string> = {
  STORE_OWNER: '/dashboard/store',
  EMPLOYEE: '/dashboard/cashier',
  DRIVER: '/dashboard/driver',
  ADMIN: '/dashboard/admin',
  SUPER_ADMIN: '/dashboard/admin',
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Calling the backend endpoint (not just clearing local state) is what
  // actually invalidates the stored refresh token — without this, a token
  // captured before "logging out" would keep working until it naturally
  // expires. onSettled clears local state either way, same as mobile's
  // logout flow, so a network hiccup never leaves the button looking stuck.
  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      logout();
      router.push('/');
    },
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="font-display font-bold text-ink">سجّل دخولك عشان تشوف حسابك</p>
        <Link href="/login" className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const links = [
    { href: '/profile/orders', label: 'طلباتي', icon: ClipboardList },
    { href: '/profile/addresses', label: 'عناويني', icon: MapPin },
    { href: '/profile/favorites', label: 'المفضلة', icon: Heart },
  ];

  const dashboardPath = DASHBOARD_PATH_BY_ROLE[user.role];

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-2xl">
      <div className="flex items-center gap-3 rounded-xl2 bg-white p-4 shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-display text-xl font-bold text-primary-700">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.fullName.charAt(0)
          )}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-ink">{user.fullName}</h2>
          <p className="text-xs text-ink/50" dir="ltr">
            {user.phone}
          </p>
          {user.email ? (
            <p className="text-xs text-ink/40" dir="ltr">
              {user.email}
            </p>
          ) : (
            <Link href="/account/add-email" className="text-xs font-bold text-primary-700">
              + ضيف إيميلك
            </Link>
          )}
        </div>
        <Link href="/profile/edit" className="rounded-full bg-primary-100 p-2 text-primary-700">
          <Pencil size={16} />
        </Link>
      </div>

      {dashboardPath && (
        <Link
          href={dashboardPath}
          className="mt-4 flex items-center justify-between rounded-xl2 bg-primary p-4 text-white shadow-card"
        >
          <span className="flex items-center gap-3 font-bold">
            <LayoutDashboard size={18} />
            لوحة التحكم
          </span>
          <ChevronLeft size={18} />
        </Link>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-soft"
          >
            <span className="flex items-center gap-3 font-medium text-ink">
              <Icon size={18} className="text-primary-700" />
              {label}
            </span>
            <ChevronLeft size={18} className="text-ink/30" />
          </Link>
        ))}

        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl2 bg-red-50 p-4 font-bold text-red-500 disabled:opacity-60"
        >
          <LogOut size={18} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
