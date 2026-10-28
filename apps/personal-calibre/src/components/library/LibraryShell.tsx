'use client';

import { ShellLayout, useLibraryT } from '@rainforest-dev/library-shell';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useIsDesktop, useLibraryShortcuts } from '@/hooks';
import { parseLibraryParams } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

import { LibraryHeader } from './LibraryHeader';

export function LibraryShell({
  children,
  filters,
  pane,
}: {
  children: ReactNode;
  filters: ReactNode;
  pane: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { filtersOpen, setFiltersOpen, closeBook } = useLibrary();
  const [ready, setReady] = useState(false);
  const t = useLibraryT(CALIBRE_NAMESPACE);
  useEffect(() => setReady(true), []);

  const isList = pathname === '/';
  useLibraryShortcuts(isList);
  const bookOpen = isList && parseLibraryParams(searchParams).book !== null;

  return (
    <ShellLayout
      data-library-ready={ready || undefined}
      header={<LibraryHeader isList={isList} />}
      mode={isList ? 'browse' : 'page'}
      filters={filters}
      pane={pane}
      isDesktop={isDesktop}
      paneOpen={bookOpen}
      filtersSheetOpen={filtersOpen}
      onFiltersSheetOpenChange={setFiltersOpen}
      onPaneClose={closeBook}
      labels={{ pane: t('pane.label') }}
    >
      {children}
    </ShellLayout>
  );
}
