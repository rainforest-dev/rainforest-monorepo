'use client';

import {
  Button,
  buttonVariants,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import {
  Archive,
  ArchiveRestore,
  FileDown,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { NotebookStatus } from '@/types';

import { notebookPdfUrl, postNotebookBulk, readError } from './api';
import { RemoveNotebooksDialog } from './RemoveNotebooksDialog';

export function NotebookActions({
  notebookId,
  name,
  status,
  pageCount,
  trashedAt,
}: {
  notebookId: number;
  name: string;
  status: NotebookStatus;
  pageCount: number;
  trashedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const archived = status === 'archived';
  const notebook = { id: notebookId, name, status, pageCount, trashedAt };

  async function restore() {
    setBusy(true);
    try {
      await postNotebookBulk('restore', [notebookId]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const removeDialog = (
    <RemoveNotebooksDialog
      notebooks={[notebook]}
      open={removing}
      onOpenChange={setRemoving}
      onDone={(mode, done) => {
        setRemoving(false);
        if (done.length === 0) return;
        // A deleted or trashed notebook has no page to come back to.
        if (mode === 'archive') router.refresh();
        else router.push('/notebooks');
      }}
    />
  );

  if (trashedAt) {
    return (
      <>
        <Button disabled={busy} onClick={() => void restore()}>
          {busy ? <Spinner /> : <RotateCcw aria-hidden />}
          Restore
        </Button>
        <Button
          variant="outline"
          className="text-destructive border-destructive/40 hover:text-destructive"
          disabled={busy}
          onClick={() => setRemoving(true)}
        >
          <Trash2 aria-hidden />
          Delete now…
        </Button>
        {removeDialog}
      </>
    );
  }

  async function update(change: { status?: NotebookStatus; name?: string }) {
    setBusy(true);
    try {
      const response = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(change),
      });
      if (!response.ok) {
        toast.error(await readError(response, 'Could not update notebook'));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function rename() {
    const next = window.prompt('Rename notebook', name)?.trim();
    if (next && next !== name) void update({ name: next });
  }

  return (
    <>
      {pageCount > 0 && (
        <a
          href={notebookPdfUrl(notebookId)}
          download
          className={buttonVariants({ variant: 'outline' })}
        >
          <FileDown aria-hidden />
          Download PDF
        </a>
      )}
      <Button variant="outline" disabled={busy} onClick={rename}>
        <Pencil aria-hidden />
        Rename
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void update({ status: archived ? 'active' : 'archived' })
        }
      >
        {busy ? (
          <Spinner />
        ) : archived ? (
          <ArchiveRestore aria-hidden />
        ) : (
          <Archive aria-hidden />
        )}
        {archived ? 'Reopen' : 'Archive'}
      </Button>
      <Button
        variant="outline"
        className="text-destructive border-destructive/40 hover:text-destructive"
        disabled={busy}
        onClick={() => setRemoving(true)}
      >
        <Trash2 aria-hidden />
        Delete…
      </Button>
      {removeDialog}
    </>
  );
}
