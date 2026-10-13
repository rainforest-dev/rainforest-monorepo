'use client';

import {
  Button,
  buttonVariants,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Archive, ArchiveRestore, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { NotebookStatus } from '@/types';

import { notebookPdfUrl, readError } from './api';

export function NotebookActions({
  notebookId,
  status,
  pageCount,
}: {
  notebookId: number;
  status: NotebookStatus;
  pageCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const archived = status === 'archived';

  async function toggleArchived() {
    setBusy(true);
    try {
      const response = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: archived ? 'active' : 'archived' }),
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
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void toggleArchived()}
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
    </>
  );
}
