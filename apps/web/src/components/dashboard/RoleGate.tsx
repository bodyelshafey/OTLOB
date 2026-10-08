'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import type { User } from '@/types';

/**
 * Client-side guard for dashboard pages. This is a UX convenience only —
 * the real enforcement happens server-side via RolesGuard on every
 * endpoint, so a determined user can't gain access just by editing the
 * frontend.
 */
export function RoleGate({
  allow,
  children,
}: {
  allow: Array<User['role']>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (user && !allow.includes(user.role)) {
      router.replace('/');
    }
  }, [accessToken, user, allow, router]);

  if (!user || !allow.includes(user.role)) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <p className="text-sm text-ink/40">جارِ التحقق من الصلاحيات...</p>
      </div>
    );
  }

  return <>{children}</>;
}
