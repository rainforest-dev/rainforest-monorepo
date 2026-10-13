import { connection } from 'next/server';
import { Suspense } from 'react';

import { CreateNotebookForm, NotebookGrid } from '@/components/notebooks';
import { listNotebooks } from '@/lib/server';

export default function NotebooksPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Notebooks</h1>
        <p className="text-muted-foreground text-sm">
          Scanned pages of paper Bullet Journals, one shelf per notebook.
        </p>
      </div>
      <CreateNotebookForm />
      <Suspense fallback={<NotebooksFallback />}>
        <NotebookShelf />
      </Suspense>
    </div>
  );
}

async function NotebookShelf() {
  await connection();
  return <NotebookGrid notebooks={await listNotebooks()} />;
}

function NotebooksFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="bg-muted aspect-[3/4] animate-pulse rounded-md"
        />
      ))}
    </div>
  );
}
