'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () => api.post('/auth/reset-password', { email, code, newPassword }).then((r) => r.data),
    onSuccess: () => setDone(true),
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'الرمز غير صحيح أو منتهي الصلاحية');
    },
  });

  if (done) {
    return (
      <div className="flex min-h-[70dvh] flex-col justify-center px-6 text-center lg:mx-auto lg:max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-ink">تم تغيير كلمة المرور</h1>
        <p className="mt-2 text-sm text-ink/50">تم تسجيل خروجك من كل الأجهزة لأسباب أمنية — سجّل دخولك بكلمة المرور الجديدة.</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card"
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">إعادة تعيين كلمة المرور</h1>
      <p className="mt-1 text-sm text-ink/50">دخّل الرمز اللي وصلك على بريدك مع كلمة المرور الجديدة</p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (newPassword !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين');
            return;
          }
          setError(null);
          submit.mutate();
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
          placeholder="رمز التحقق (6 أرقام)"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <input
          required
          type="password"
          placeholder="كلمة المرور الجديدة (٨ أحرف على الأقل)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          dir="ltr"
          minLength={8}
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <input
          required
          type="password"
          placeholder="تأكيد كلمة المرور الجديدة"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          dir="ltr"
          minLength={8}
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submit.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {submit.isPending ? 'جارِ الحفظ...' : 'تغيير كلمة المرور'}
        </button>
      </form>
    </div>
  );
}
