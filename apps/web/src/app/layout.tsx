import type { Metadata } from 'next';
import { Cairo, Tajawal, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { getLocale } from '@/i18n/get-locale';
import arMessages from '@/i18n/messages/ar.json';
import enMessages from '@/i18n/messages/en.json';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['600', '700', '800'],
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
  weight: ['400', '500', '700'],
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['500', '600'],
});

export const metadata: Metadata = {
  title: 'أطلب — OTLOB | العاصمة الإدارية الجديدة',
  icons: '/favicon.ico',
  description:
    'اطلب من مطاعمك وصيدلياتك وسوبر ماركت حيك المفضلة في العاصمة الإدارية الجديدة، وهيوصلك بسرعة.',
};

const MESSAGES_BY_LOCALE = { ar: arMessages, en: enMessages };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = MESSAGES_BY_LOCALE[locale];

  return (
    <html lang={locale} dir={dir}>
      <body className={`${cairo.variable} ${tajawal.variable} ${plexMono.variable} font-body antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div style={{background: '#dff7ff',minHeight: '100vh',paddingBottom: '60px'}}>
              <Header />
              <div style={{background: '#fff',minHeight:'100vh',margin: '15px',borderRadius: '30px',boxShadow:'0 10px 30px rgba(0,0,0,.08)',}}>
              <main>{children}</main>
              </div>
              <BottomNav />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
