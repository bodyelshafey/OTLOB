'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => api.post('/auth/login', { email, password }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push(redirect);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'خطأ في البريد الإلكتروني أو كلمة المرور');
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
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {login.isPending ? 'جارِ الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-primary-700">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
