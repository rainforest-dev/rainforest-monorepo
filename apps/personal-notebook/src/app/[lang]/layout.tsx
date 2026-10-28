import '@/app/globals.css';

import {
  HTML_LANG,
  LIBRARY_LOCALES,
  pageTitleTemplate,
} from '@rainforest-dev/library-contract';
import { LibraryI18nProvider, ShellHead } from '@rainforest-dev/library-shell';
import { Toaster } from '@rainforest-dev/rainforest-react';
import type { Metadata } from 'next';

import { NotebookShell } from '@/components/shell';
import { NOTEBOOK_RESOURCES, notebookT, pageLocale } from '@/locales';

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

/** The proxy rewrites every page to the reader's locale, so the URL never shows it. */
export function generateStaticParams() {
  return LIBRARY_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  return {
    title: pageTitleTemplate(locale, 'notebooks'),
    description: notebookT(locale)('meta.description'),
  };
}

export default async function RootLayout({ children, params }: Props) {
  const locale = await pageLocale(params);
  return (
    <html lang={HTML_LANG[locale]} className="font-sans">
      <body className="bg-background text-foreground min-h-screen">
        <ShellHead />
        <LibraryI18nProvider
          locale={locale}
          resources={{ [locale]: NOTEBOOK_RESOURCES[locale] }}
        >
          <NotebookShell>{children}</NotebookShell>
        </LibraryI18nProvider>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
