'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = useMutation({
    mutationFn: () => api.post('/auth/forgot-password', { email }).then((r) => r.data),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex min-h-[70dvh] flex-col justify-center px-6 text-center lg:mx-auto lg:max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-ink">تحقق من بريدك</h1>
        <p className="mt-2 text-sm text-ink/50">
          لو في حساب مرتبط بالبريد ده، هيوصلك رمز لإعادة تعيين كلمة المرور خلال دقائق.
        </p>
        <button
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
          className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card"
        >
          عندي الرمز بالفعل
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">نسيت كلمة المرور؟</h1>
      <p className="mt-1 text-sm text-ink/50">هنبعتلك رمز لإعادة تعيين كلمة المرور على بريدك</p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
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
        <button
          type="submit"
          disabled={submit.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {submit.isPending ? 'جارِ الإرسال...' : 'إرسال الرمز'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        رجعلك بالك؟{' '}
        <Link href="/login" className="font-bold text-primary-700">
          تسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
