'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Authenticated flow for adding/verifying a phone AFTER login — used today
// for Google Sign-In accounts, which never collect a phone number during
// OAuth (see AuthService.googleAuth's `phoneVerificationRequired` flag).
// Uses the JWT-protected /auth/phone/* endpoints, distinct from the public
// /auth/verify-phone used during normal registration — see
// dto/phone/verify-added-phone.dto.ts for why the two are split.
export default function AddPhonePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [phone, setPhone] = useState('+20');
  const [error, setError] = useState<string | null>(null);

  const addPhone = useMutation({
    mutationFn: () => api.post('/auth/phone/add', { phone }).then((r) => r.data),
    onSuccess: () => {
      router.push(`/account/verify-phone?redirect=${encodeURIComponent(redirect)}`);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'تعذر إضافة رقم الهاتف');
    },
  });

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-6 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-2xl font-extrabold text-ink">أضف رقم هاتفك</h1>
      <p className="mt-1 text-sm text-ink/50">هنبعتلك رمز تأكيد على الرقم ده — يساعدنا نوصلك بسهولة أثناء التوصيل</p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          addPhone.mutate();
        }}
      >
        <input
          required
          placeholder="+20 1xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        <p className="text-xs text-ink/40">بالصيغة الدولية، مثال: ‎+201234567890</p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={addPhone.isPending}
          className="mt-2 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
        >
          {addPhone.isPending ? 'جارِ الإرسال...' : 'إرسال رمز التأكيد'}
        </button>
      </form>
    </div>
  );
}
