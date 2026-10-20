'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { useState } from 'react';

import { NOTEBOOK_NAMESPACE } from '@/locales';
import type { NotebookPage } from '@/types';

import { pageImageUrl } from './api';
import { PageDetailDialog, pageLabel } from './PageDetailDialog';

export function NotebookPageGrid({
  notebookName,
  pages,
}: {
  notebookName: string;
  pages: readonly NotebookPage[];
}) {
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const [openId, setOpenId] = useState<number | null>(null);
  const open = pages.find((page) => page.id === openId) ?? null;

  if (pages.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {t('pages.empty')}
      </p>
    );
  }

  return (
    <>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              onClick={() => setOpenId(page.id)}
              aria-label={pageLabel(page, t)}
              className="focus-visible:outline-ring group flex w-full flex-col gap-1 rounded-md text-left outline-offset-2 focus-visible:outline-2"
            >
              <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-md border">
                <img
                  src={pageImageUrl(page.id)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {page.transcription && (
                  <span
                    className="bg-success absolute right-1.5 top-1.5 size-2 rounded-full"
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {page.pageNumber ?? page.position}
                {page.pageDate && ` · ${page.pageDate}`}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <PageDetailDialog
        notebookName={notebookName}
        page={open}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
