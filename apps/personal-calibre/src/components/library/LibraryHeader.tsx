'use client';

import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { LibraryBig, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { filterCount, parseLibraryParams } from '@/lib/library-params';

import { useLibrary } from './LibraryProvider';
import { SearchField } from './SearchField';
import { ViewSwitch } from './ViewSwitch';

export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  const params = parseLibraryParams(useSearchParams());
  const count = filterCount(params);
  return (
    <header className="bg-background sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 lg:h-14 lg:flex-nowrap lg:px-4 lg:py-0">
      {isList && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label={panelOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={panelOpen}
          aria-controls="library-filters"
          onClick={togglePanel}
        >
          {panelOpen ? (
            <PanelLeftClose aria-hidden />
          ) : (
            <PanelLeftOpen aria-hidden />
          )}
        </Button>
      )}
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <LibraryBig className="size-5" aria-hidden />
        Library
      </Link>
      {isList && <ViewSwitch className="ml-auto lg:ml-2" />}
      {isList && (
        <div className="order-last w-full lg:order-none lg:mx-auto lg:w-auto lg:max-w-[420px] lg:flex-1">
          <SearchField key={params.q ?? ''} initialQuery={params.q ?? ''} />
        </div>
      )}
      {isList && !panelOpen && count > 0 && (
        <Badge variant="secondary" className="hidden lg:inline-flex">
          {count} filter{count === 1 ? '' : 's'}
        </Badge>
      )}
    </header>
  );
}
