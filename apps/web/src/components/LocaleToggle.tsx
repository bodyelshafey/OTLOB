'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';

const COOKIE_NAME = 'NEXT_LOCALE';

export function LocaleToggle() {
  const router = useRouter();
  const locale = useLocale();

  const toggle = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <button
      onClick={toggle}
      aria-label="Switch language"
      className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-primary-50 text-primary-700"
    >
      <Languages size={16} />
    </button>
  );
}
