'use client';

import { BookOpen, LayoutGrid } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib';
import type { NotebookPage } from '@/types';

import { NotebookPageGrid } from './NotebookPageGrid';
import { PageDetailDialog } from './PageDetailDialog';
import { NotebookReader } from './reader';

type Layout = 'book' | 'pages';

const LAYOUTS: readonly {
  value: Layout;
  label: string;
  Icon: typeof BookOpen;
}[] = [
  { value: 'book', label: 'Book', Icon: BookOpen },
  { value: 'pages', label: 'Pages', Icon: LayoutGrid },
];

/** A notebook's pages, read as a book or laid out as a grid to organise; `?layout=` keeps the choice. */
export function NotebookBody({
  notebookName,
  pages,
}: {
  notebookName: string;
  pages: readonly NotebookPage[];
}) {
  const params = useSearchParams();
  const [layout, setLayout] = useState<Layout>(
    params.get('layout') === 'pages' ? 'pages' : 'book',
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const requested = Number(params.get('page'));
  const initialPageId = Number.isSafeInteger(requested) ? requested : null;

  function choose(next: Layout) {
    setLayout(next);
    const url = new URL(window.location.href);
    if (next === 'book') url.searchParams.delete('layout');
    else url.searchParams.set('layout', next);
    window.history.replaceState(window.history.state, '', url);
  }

  if (pages.length === 0)
    return <NotebookPageGrid notebookName={notebookName} pages={pages} />;

  return (
    <div className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Layout"
        className="bg-muted flex w-fit gap-0.5 rounded-lg p-0.5"
      >
        {LAYOUTS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={layout === value}
            onClick={() => choose(value)}
            className={cn(
              'focus-visible:outline-ring flex h-8 items-center gap-1.5 rounded-md px-3 text-sm outline-offset-1 focus-visible:outline-2',
              layout === value
                ? 'bg-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {layout === 'book' ? (
        <>
          <NotebookReader
            pages={pages}
            initialPageId={initialPageId}
            onOpenPage={setDetailId}
          />
          <PageDetailDialog
            notebookName={notebookName}
            page={pages.find((page) => page.id === detailId) ?? null}
            onClose={() => setDetailId(null)}
          />
        </>
      ) : (
        <NotebookPageGrid notebookName={notebookName} pages={pages} />
      )}
    </div>
  );
}
