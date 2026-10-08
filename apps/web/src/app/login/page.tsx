'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => api.post('/auth/login', { identifier, password }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push(redirect);
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      // Correct credentials but the phone hasn't been verified yet — see
      // AuthService.login (2026-09-13 pivot: email verification no longer
      // gates login at all, only phone does).
      if (body?.code === 'PHONE_VERIFICATION_REQUIRED') {
        router.push(`/register/verify-phone?phone=${encodeURIComponent(body.phone ?? '')}&redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      // No response at all (API down/unreachable) or a 5xx is NOT a credentials
      // problem — don't tell the user their password is wrong.
      const status = err?.response?.status;
      if (!err?.response) {
        setError('تعذّر الاتصال بالخادم، حاول مرة أخرى بعد قليل');
        return;
      }
      if (status >= 500) {
        setError('حدث خطأ في الخادم، حاول مرة أخرى بعد قليل');
        return;
      }
      setError(body?.message ?? 'رقم الهاتف أو كلمة المرور غير صحيحة');
    },
  });

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">أهلاً بيك تاني 👋</h1>
      <p className="mt-1 text-sm text-ink/50">سجّل دخولك عشان تكمل طلبك</p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <input
          required
          type="text"
          placeholder="رقم الهاتف"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <input
          required
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <Link href="/forgot-password" className="text-start text-xs font-bold text-primary-700">
          نسيت كلمة المرور؟
        </Link>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {login.isPending ? 'جارِ الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-ink/40">أو</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>
      <div className="mt-4">
        <GoogleSignInButton redirect={redirect} />
      </div>

      <p className="mt-6 text-center text-sm text-ink/50">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-primary-700">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
