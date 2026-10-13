import { NotebookPen } from 'lucide-react';
import Link from 'next/link';

import type { NotebookSummary } from '@/types';

import { pageImageUrl } from './api';

export function NotebookGrid({
  notebooks,
}: {
  notebooks: readonly NotebookSummary[];
}) {
  if (notebooks.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No notebooks yet. Name one below to start its shelf.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      {notebooks.map((notebook) => (
        <li key={notebook.id}>
          <Link
            href={`/notebooks/${notebook.id}`}
            prefetch={false}
            className="focus-visible:outline-ring group flex flex-col gap-2 rounded-md outline-offset-4 focus-visible:outline-2"
          >
            <div className="bg-muted relative aspect-[3/4] overflow-hidden rounded-md border">
              {notebook.coverPageId === null ? (
                <div className="text-muted-foreground flex size-full items-center justify-center">
                  <NotebookPen className="size-8" aria-hidden />
                </div>
              ) : (
                <img
                  src={pageImageUrl(notebook.coverPageId)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              )}
              {notebook.status === 'archived' && (
                <span className="bg-background/85 text-muted-foreground absolute left-2 top-2 rounded px-1.5 py-0.5 text-xs">
                  Archived
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{notebook.name}</p>
              <p className="text-muted-foreground text-xs">
                {notebook.pageCount} page{notebook.pageCount === 1 ? '' : 's'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
