'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () =>
      api.post('/auth/register', { fullName, email, phone, password }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push('/');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'تعذر إنشاء الحساب، تأكد من البيانات');
    },
  });

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">إنشاء حساب جديد</h1>
      <p className="mt-1 text-sm text-ink/50">هتاخد أقل من دقيقة</p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate();
        }}
      >
        <input
          required
          placeholder="الاسم بالكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
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
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <input
          required
          type="password"
          placeholder="كلمة المرور (٨ أحرف على الأقل)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          minLength={8}
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={register.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {register.isPending ? 'جارِ الإنشاء...' : 'إنشاء الحساب'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-bold text-primary-700">
          تسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
