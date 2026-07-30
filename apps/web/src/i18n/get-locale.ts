import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: AppLocale = 'ar';
const COOKIE_NAME = 'NEXT_LOCALE';

/** Reads the active locale from a cookie set by <LocaleToggle>. Server-only. */
export async function getLocale(): Promise<AppLocale> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return SUPPORTED_LOCALES.includes(value as AppLocale) ? (value as AppLocale) : DEFAULT_LOCALE;
}

export { COOKIE_NAME };
