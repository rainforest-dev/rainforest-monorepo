import { type LibraryLocale } from '@rainforest-dev/library-contract';
import { LibraryI18nProvider } from '@rainforest-dev/library-shell';
import { type ReactNode } from 'react';

import { ROOM_RESOURCES } from '@/locales';

/**
 * The library's translator for one island. Each Astro island is its own React root, so each
 * one wraps itself in this; only its locale's dictionary reaches the client.
 */
export function RoomI18n({
  locale,
  children,
}: {
  locale: LibraryLocale;
  children: ReactNode;
}) {
  return (
    <LibraryI18nProvider
      locale={locale}
      resources={{ [locale]: ROOM_RESOURCES[locale] }}
    >
      {children}
    </LibraryI18nProvider>
  );
}
