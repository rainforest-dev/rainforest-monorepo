import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import {
  NotebookActions,
  NotebookBody,
  PageUploader,
} from '@/components/notebooks';
import { daysLeftInTrash } from '@/lib/notebook';
import { getNotebook } from '@/lib/server';
import { notebookT, pageLocale } from '@/locales';

import { BackLink } from './BackLink';

interface Props {
  params: Promise<{ lang: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const id = Number((await params).id);
  const notebook =
    Number.isSafeInteger(id) && id > 0 ? await getNotebook(id) : null;
  return notebook ? { title: notebook.name } : {};
}

export default function NotebookPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <BackLink />
      <Suspense
        fallback={<div className="bg-muted h-40 animate-pulse rounded-md" />}
      >
        <NotebookContent params={params} />
      </Suspense>
    </div>
  );
}

async function NotebookContent({ params }: Props) {
  await connection();
  const t = notebookT(await pageLocale(params));
  const notebookId = Number((await params).id);
  if (!Number.isSafeInteger(notebookId) || notebookId < 1) notFound();
  const notebook = await getNotebook(notebookId);
  if (!notebook) notFound();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {notebook.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('notebook.pages', { count: notebook.pageCount })}
            {notebook.status === 'archived' &&
              (notebook.endedOn
                ? t('notebook.archivedOn', { date: notebook.endedOn })
                : t('notebook.archived'))}
            {notebook.trashedAt &&
              t('notebook.inTrash', {
                days: daysLeftInTrash(notebook.trashedAt),
              })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotebookActions
            notebookId={notebook.id}
            name={notebook.name}
            status={notebook.status}
            pageCount={notebook.pageCount}
            trashedAt={notebook.trashedAt}
          />
          <PageUploader notebookId={notebook.id} />
        </div>
      </div>
      <NotebookBody notebookName={notebook.name} pages={notebook.pages} />
    </>
  );
}
