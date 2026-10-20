'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
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

import { withBase } from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';
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
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
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
        else router.push('/');
      }}
    />
  );

  if (trashedAt) {
    return (
      <>
        <Button disabled={busy} onClick={() => void restore()}>
          {busy ? <Spinner /> : <RotateCcw aria-hidden />}
          {t('grid.restore')}
        </Button>
        <Button
          variant="outline"
          className="text-destructive border-destructive/40 hover:text-destructive"
          disabled={busy}
          onClick={() => setRemoving(true)}
        >
          <Trash2 aria-hidden />
          {t('grid.deleteNow')}
        </Button>
        {removeDialog}
      </>
    );
  }

  async function update(change: { status?: NotebookStatus; name?: string }) {
    setBusy(true);
    try {
      const response = await fetch(withBase(`/api/notebooks/${notebookId}`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(change),
      });
      if (!response.ok) {
        toast.error(await readError(response, t('actions.updateFailed')));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function rename() {
    const next = window.prompt(t('actions.renamePrompt'), name)?.trim();
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
          {t('actions.downloadPdf')}
        </a>
      )}
      <Button variant="outline" disabled={busy} onClick={rename}>
        <Pencil aria-hidden />
        {t('actions.rename')}
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
        {archived ? t('grid.reopen') : t('remove.archive')}
      </Button>
      <Button
        variant="outline"
        className="text-destructive border-destructive/40 hover:text-destructive"
        disabled={busy}
        onClick={() => setRemoving(true)}
      >
        <Trash2 aria-hidden />
        {t('grid.delete')}
      </Button>
      {removeDialog}
    </>
  );
}
