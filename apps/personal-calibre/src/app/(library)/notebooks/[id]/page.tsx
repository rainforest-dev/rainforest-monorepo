import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import {
  NotebookActions,
  NotebookPageGrid,
  PageUploader,
} from '@/components/notebooks';
import { getNotebook } from '@/lib/server';

interface Props {
  params: Promise<{ id: string }>;
}

export default function NotebookPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link
        href="/notebooks"
        prefetch={false}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Notebooks
      </Link>
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
            {notebook.pageCount} page{notebook.pageCount === 1 ? '' : 's'}
            {notebook.status === 'archived' &&
              ` · Archived${notebook.endedOn ? ` ${notebook.endedOn}` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotebookActions
            notebookId={notebook.id}
            name={notebook.name}
            status={notebook.status}
            pageCount={notebook.pageCount}
          />
          <PageUploader notebookId={notebook.id} />
        </div>
      </div>
      <NotebookPageGrid notebookName={notebook.name} pages={notebook.pages} />
    </>
  );
}
