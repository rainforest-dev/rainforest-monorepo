'use client';

import { ShellLayout } from '@rainforest-dev/library-shell';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useIsDesktop, useLibraryShortcuts } from '@/hooks';
import { parseLibraryParams } from '@/lib';
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
  const { panelOpen, filtersOpen, setFiltersOpen, closeBook } = useLibrary();
  const [ready, setReady] = useState(false);
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
      filtersVisible={panelOpen}
      paneOpen={bookOpen}
      filtersSheetOpen={filtersOpen}
      onFiltersSheetOpenChange={setFiltersOpen}
      onPaneClose={closeBook}
      labels={{ pane: 'Book details' }}
    >
      {children}
    </ShellLayout>
  );
}
