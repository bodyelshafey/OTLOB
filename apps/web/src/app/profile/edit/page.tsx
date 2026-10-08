'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

// Profile editing (Phase 3, 2026-09-13): name, avatar, and optional email
// (no OTP — §8.4). `phone` is deliberately not editable here — it's shown
// read-only, with a link to /account/add-phone (which requires a fresh
// OTP before the new number is trusted; a plain profile PATCH has no way
// to re-verify it).
export default function EditProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'avatars');
      const { data } = await api.post<{ url: string }>('/upload/image', fd);
      setAvatar(data.url);
    } catch {
      // Reuses the upload module's own validation errors (size/type) —
      // nothing extra to show here beyond letting the request fail
      // silently and the avatar staying unchanged.
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: updated } = await api.patch('/users/me', { fullName, avatar });
      if (email && email !== user?.email) {
        await api.post('/auth/email/add', { email });
      }
      return { ...updated, email: email || updated.email };
    },
    onSuccess: (updated) => {
      setUser(updated);
      router.back();
    },
    onError: (err: any) => {
      if (err?.response?.data?.code === 'EMAIL_ALREADY_EXISTS') {
        setEmailError('يوجد حساب بالفعل مسجّل بهذا الإيميل.');
        return;
      }
    },
  });

  return (
    <div className="px-4 pt-4 lg:mx-auto lg:max-w-md">
      <h1 className="font-display text-xl font-extrabold text-ink">تعديل البيانات</h1>

      <div className="mt-6 flex flex-col items-center">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary-100"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-bold text-primary-700">
              {fullName.charAt(0)}
            </span>
          )}
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-white">
            {uploading ? '...' : '✎'}
          </span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="الاسم بالكامل"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
          }}
          placeholder="الإيميل (اختياري)"
          dir="ltr"
          className="w-full rounded-xl2 bg-white px-4 py-3 text-sm shadow-soft outline-none"
        />
        {emailError && <p className="text-xs font-bold text-red-500">{emailError}</p>}

        <div className="flex items-center justify-between rounded-xl2 bg-white px-4 py-3 shadow-soft">
          <div>
            <p className="text-xs text-ink/50">رقم الهاتف</p>
            <p className="text-sm font-bold text-ink" dir="ltr">
              {user?.phone ?? '—'}
            </p>
          </div>
          <button
            onClick={() => router.push('/account/add-phone')}
            className="text-xs font-bold text-primary-700"
          >
            {user?.phone ? 'تغيير' : 'إضافة'}
          </button>
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || uploading}
        className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-white shadow-card disabled:opacity-50"
      >
        {save.isPending ? 'جارِ الحفظ...' : 'حفظ'}
      </button>
    </div>
  );
}
