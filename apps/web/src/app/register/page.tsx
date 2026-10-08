'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';

// PIVOTED 2026-09-13: phone is the sole primary identity now — no email
// field here at all. Registration is a 2-step flow: create account
// (phone+password) → verify phone OTP (see /register/verify-phone) →
// done. Email becomes a fully optional step AFTER that (see
// /account/add-email), not part of registration itself.
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLoginCta, setShowLoginCta] = useState(false);

  const register = useMutation({
    mutationFn: () => api.post('/auth/register', { fullName, phone, password }).then((r) => r.data),
    onSuccess: (data) => {
      router.push(`/register/verify-phone?phone=${encodeURIComponent(data.phone)}&redirect=${encodeURIComponent(redirect)}`);
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.code === 'PHONE_ALREADY_EXISTS') {
        setError('يوجد حساب بالفعل مسجّل بهذا الرقم.');
        setShowLoginCta(true);
        return;
      }
      setShowLoginCta(false);
      setError(body?.message ?? 'تعذر إنشاء الحساب، تأكد من البيانات');
    },
  });

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">إنشاء حساب جديد</h1>
      <p className="mt-1 text-sm text-ink/50">هنبعتلك رمز تأكيد على رقم هاتفك</p>

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
          type="tel"
          placeholder="01xxxxxxxxx أو ‎+201xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <p className="-mt-2 text-xs text-ink/40">
          أي صيغة مصرية شائعة تمام — هنظبطها تلقائيًا (٠١، بدون الصفر، أو بالصيغة الدولية)
        </p>
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

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">
            {error}
            {showLoginCta && (
              <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="mr-1 underline">
                تسجيل الدخول
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {register.isPending ? 'جارِ الإنشاء...' : 'إنشاء الحساب'}
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
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-bold text-primary-700">
          تسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
