'use client';

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useLibraryShortcuts } from '@/hooks/useLibraryShortcuts';
import { parseLibraryParams } from '@/lib/library-params';
import { cn } from '@/lib/utils';

import { LibraryHeader } from './LibraryHeader';
import { useLibrary } from './LibraryProvider';

const COLUMNS = {
  both: 'lg:grid-cols-[248px_minmax(0,1fr)_420px]',
  filters: 'lg:grid-cols-[248px_minmax(0,1fr)]',
  pane: 'lg:grid-cols-[minmax(0,1fr)_420px]',
  none: 'lg:grid-cols-1',
} as const;

const SIDE_COLUMN =
  'hidden lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto';

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
  const columns = panelOpen
    ? bookOpen
      ? 'both'
      : 'filters'
    : bookOpen
      ? 'pane'
      : 'none';

  return (
    <div className="min-h-dvh" data-library-ready={ready || undefined}>
      <LibraryHeader isList={isList} />
      {isList ? (
        <div className={cn('lg:grid', COLUMNS[columns])}>
          {isDesktop && (
            <aside
              id="library-filters"
              aria-label="Filters"
              hidden={!panelOpen}
              className={cn(
                'bg-sidebar text-sidebar-foreground border-r',
                SIDE_COLUMN,
              )}
            >
              {filters}
            </aside>
          )}
          <main
            id="library-main"
            className="min-w-0 px-3 pb-24 lg:px-6 lg:pb-0"
          >
            {children}
          </main>
          {isDesktop && bookOpen && (
            <aside
              aria-label="Book details"
              className={cn('bg-card border-l', SIDE_COLUMN)}
            >
              {pane}
            </aside>
          )}
        </div>
      ) : (
        <main id="library-main" className="px-3 py-6 lg:px-6">
          {children}
        </main>
      )}
      {isList && !isDesktop && (
        <>
          <Sheet side="left" open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent closeLabel="Close filters" className="bg-sidebar">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <SheetBody className="px-0">{filters}</SheetBody>
            </SheetContent>
          </Sheet>
          <Sheet
            side="bottom"
            open={bookOpen}
            onOpenChange={(open) => {
              if (!open) closeBook();
            }}
          >
            <SheetContent showCloseButton={false} className="h-[92dvh]">
              <SheetTitle className="sr-only">Book details</SheetTitle>
              <SheetBody className="px-0">{pane}</SheetBody>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
