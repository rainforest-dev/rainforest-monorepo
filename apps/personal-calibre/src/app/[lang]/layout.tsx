import '@/app/globals.css';

import { HTML_LANG, LIBRARY_LOCALES } from '@rainforest-dev/library-contract';
import { LibraryI18nProvider, ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';
import type { Metadata } from 'next';

import { CALIBRE_RESOURCES, calibreT, pageLocale } from '@/locales';

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

/** The proxy rewrites every page to the reader's locale, so the URL never shows it. */
export function generateStaticParams() {
  return LIBRARY_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = calibreT(await pageLocale(params));
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function RootLayout({ children, params }: Props) {
  const locale = await pageLocale(params);
  return (
    <html lang={HTML_LANG[locale]} className="font-sans">
      <body className="bg-background text-foreground min-h-screen">
        <ShellHead />
        <LibraryI18nProvider
          locale={locale}
          resources={{ [locale]: CALIBRE_RESOURCES[locale] }}
        >
          {children}
        </LibraryI18nProvider>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
