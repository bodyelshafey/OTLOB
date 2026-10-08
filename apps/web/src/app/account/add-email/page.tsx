'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

// The optional "Add your email" onboarding step (2026-09-13 phone-first
// pivot) — shown right after phone verification succeeds, but fully
// skippable. No OTP here; see AuthService.addEmail. Also reachable later
// from Profile settings for anyone who skipped it initially.
export default function AddEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const addEmail = useMutation({
    mutationFn: () => api.post('/auth/email/add', { email }).then((r) => r.data),
    onSuccess: () => {
      if (user) setUser({ ...user, email });
      router.push(redirect);
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.code === 'EMAIL_ALREADY_EXISTS') {
        setError('يوجد حساب بالفعل مسجّل بهذا الإيميل.');
        setShowLoginHint(true);
        return;
      }
      setShowLoginHint(false);
      setError(body?.message ?? 'تعذر حفظ الإيميل');
    },
  });

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">
        {isOnboarding ? 'ضيف إيميلك (اختياري)' : 'إضافة إيميل'}
      </h1>
      <p className="mt-1 text-sm text-ink/50">
        هيساعدنا نبعتلك إيصالات وتحديثات مهمة — تقدر تضيفه دلوقتي أو بعدين من إعدادات حسابك
      </p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          addEmail.mutate();
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

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">
            {error}
            {showLoginHint && ' جرّب إيميل تاني أو اضغط تخطي.'}
          </p>
        )}

        <button
          type="submit"
          disabled={addEmail.isPending || !email}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {addEmail.isPending ? 'جارِ الحفظ...' : 'حفظ'}
        </button>
      </form>

      {isOnboarding && (
        <button onClick={() => router.push(redirect)} className="mt-4 text-center text-sm font-bold text-ink/40">
          تخطي الآن
        </button>
      )}
    </div>
  );
}
