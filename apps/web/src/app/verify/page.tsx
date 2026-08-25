'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const redirect = searchParams.get('redirect') ?? '/';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [justResent, setJustResent] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: (code: string) => api.post('/auth/verify-email', { email, code }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push(redirect);
    },
    onError: () => {
      setError('الرمز غير صحيح، حاول مرة أخرى');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    },
  });

  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification', { email }).then((r) => r.data),
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN);
      setError(null);
      setJustResent(true);
    },
  });

  const handleChange = (value: string, index: number) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
      const next = Array(CODE_LENGTH).fill('');
      pasted.forEach((d, i) => (next[i] = d));
      setDigits(next);
      const lastIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
      inputs.current[lastIndex]?.focus();
      if (pasted.length === CODE_LENGTH) verify.mutate(next.join(''));
      return;
    }
    const next = [...digits];
    next[index] = value.replace(/\D/g, '');
    setDigits(next);
    setError(null);
    if (value && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === CODE_LENGTH) {
      verify.mutate(next.join(''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  if (!email) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-ink/50">رابط غير صالح — ارجع لصفحة إنشاء الحساب.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="text-center font-display text-2xl font-extrabold text-ink">تأكيد البريد الإلكتروني</h1>
      <p className="mt-2 text-center text-sm text-ink/50">أرسلنا رمز تحقق مكوّن من 6 أرقام إلى</p>
      <p className="text-center font-bold text-primary-700" dir="ltr">
        {email}
      </p>

      <div className="mt-6 flex justify-center gap-2" dir="ltr">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => handleChange(e.target.value, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            className={`h-14 w-11 rounded-xl2 border text-center font-display text-xl font-bold outline-none ${
              error ? 'border-red-400' : 'border-transparent bg-white shadow-soft'
            }`}
          />
        ))}
      </div>

      {error && <p className="mt-3 text-center text-xs font-bold text-red-500">{error}</p>}

      <button
        onClick={() => verify.mutate(digits.join(''))}
        disabled={digits.some((d) => !d) || verify.isPending}
        className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
      >
        {verify.isPending ? 'جارِ التأكيد...' : 'تأكيد'}
      </button>

      <button
        onClick={() => resend.mutate()}
        disabled={cooldown > 0 || resend.isPending}
        className="mt-4 text-center text-sm font-bold text-primary-700 disabled:text-ink/30"
      >
        {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown}s` : 'إعادة إرسال الرمز'}
      </button>
      {justResent && cooldown === RESEND_COOLDOWN && (
        <p className="mt-1 text-center text-xs text-green-600">تم إرسال رمز جديد</p>
      )}
    </div>
  );
}
