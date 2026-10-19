'use client';

import { SHELL_IDS, ShellHeader } from '@rainforest-dev/library-shell';
import { Badge, Button } from '@rainforest-dev/rainforest-react';
import {
  LibraryBig,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { filterCount, parseLibraryParams } from '@/lib';
import { useLibrary } from '@/providers';

import { SearchField } from './SearchField';
import { ViewSwitch } from './ViewSwitch';

export function LibraryHeader({ isList }: { isList: boolean }) {
  const { panelOpen, togglePanel } = useLibrary();
  const params = parseLibraryParams(useSearchParams());
  const count = filterCount(params);
  return (
    <ShellHeader>
      {isList && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label={panelOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={panelOpen}
          aria-controls={SHELL_IDS.filters}
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
        prefetch={false}
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <LibraryBig className="size-5" aria-hidden />
        Library
      </Link>
      <Link
        href="/notebooks"
        prefetch={false}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <NotebookPen className="size-4" aria-hidden />
        Notebooks
      </Link>
      {isList && <ViewSwitch className="ml-auto lg:ml-2" />}
      {isList && (
        <div className="order-last w-full lg:order-none lg:mx-auto lg:w-auto lg:max-w-[420px] lg:flex-1">
          <SearchField initialQuery={params.q ?? ''} />
        </div>
      )}
      {isList && !panelOpen && count > 0 && (
        <Badge variant="secondary" className="hidden lg:inline-flex">
          {count} filter{count === 1 ? '' : 's'}
        </Badge>
      )}
    </ShellHeader>
  );
}
