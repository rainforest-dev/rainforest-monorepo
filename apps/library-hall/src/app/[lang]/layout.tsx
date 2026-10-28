import '@/app/globals.css';

import {
  HTML_LANG,
  isLibraryLocale,
  LIBRARY_LOCALES,
  type LibraryLocale,
  pageTitle,
} from '@rainforest-dev/library-contract';
import { LibraryI18nProvider, ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HALL_RESOURCES, hallMessages } from '@/locales';

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

/**
 * One static hall per locale. The proxy rewrites `/` to the reader's, so the URL never shows
 * it and the page stays static, which the bfcache needs.
 */
export function generateStaticParams() {
  return LIBRARY_LOCALES.map((lang) => ({ lang }));
}

async function localeOf(params: Props['params']): Promise<LibraryLocale> {
  const { lang } = await params;
  if (!isLibraryLocale(lang)) notFound();
  return lang;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { meta } = hallMessages(locale);
  return { title: pageTitle(locale, 'hall'), description: meta.description };
}

export default async function RootLayout({ children, params }: Props) {
  const locale = await localeOf(params);
  return (
    <html lang={HTML_LANG[locale]} className="font-sans">
      <body className="bg-background text-foreground min-h-screen">
        <ShellHead />
        <LibraryI18nProvider
          locale={locale}
          resources={{ [locale]: HALL_RESOURCES[locale] }}
        >
          {children}
        </LibraryI18nProvider>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
