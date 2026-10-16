'use client';

import { Button, Spinner, toast } from '@rainforest-dev/rainforest-react';
import {
  Archive,
  ArchiveRestore,
  Check,
  FileDown,
  Merge,
  NotebookPen,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib';
import { daysLeftInTrash, TRASH_DAYS } from '@/lib/notebook';
import type { NotebookSummary } from '@/types';

import { notebookPdfUrl, pageImageUrl, postNotebookBulk } from './api';
import { MergeNotebooksDialog } from './MergeNotebooksDialog';
import { RemoveNotebooksDialog } from './RemoveNotebooksDialog';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// On a phone the actions share a row of equal cells, icon over label, tall enough to tap.
const action =
  'h-12 flex-col gap-0.5 px-1 text-xs sm:h-7 sm:flex-row sm:gap-1 sm:px-2.5 sm:text-[0.8rem]';

/**
 * The notebook shelf. "Select" turns covers into checkboxes and brings up a toolbar that
 * archives, merges, exports, moves to Trash or deletes the selection. In Trash the toolbar
 * restores or deletes instead.
 */
export function NotebookGrid({
  notebooks,
  trash = false,
}: {
  notebooks: readonly NotebookSummary[];
  /** The notebooks shown are the ones in Trash. */
  trash?: boolean;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [dialog, setDialog] = useState<'remove' | 'merge' | null>(null);
  const [busy, setBusy] = useState(false);
  // In shelf order, and only notebooks still shown after a refresh.
  const selected = notebooks.filter((n) => picked.has(n.id));

  function stopSelecting() {
    setSelecting(false);
    setPicked(new Set());
  }

  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialog === null) stopSelecting();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, dialog]);

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function finish() {
    setDialog(null);
    stopSelecting();
    router.refresh();
  }

  async function run(action: 'archive' | 'reopen' | 'restore') {
    setBusy(true);
    try {
      const { done, failed } = await postNotebookBulk(
        action,
        selected.map((n) => n.id),
      );
      if (failed.length > 0) {
        toast.error(
          `${plural(failed.length, 'notebook')} not changed: ${failed[0].error}`,
        );
      }
      const verb = {
        archive: 'Archived',
        reopen: 'Reopened',
        restore: 'Restored',
      }[action];
      if (done.length > 0)
        toast.success(`${verb} ${plural(done.length, 'notebook')}`);
      finish();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function exportPdfs() {
    for (const notebook of selected) {
      if (notebook.pageCount === 0) continue;
      const link = document.createElement('a');
      link.href = notebookPdfUrl(notebook.id);
      link.download = '';
      link.click();
    }
  }

  if (notebooks.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {trash
          ? 'Trash is empty.'
          : 'No notebooks yet. Name one below to start its shelf.'}
      </p>
    );
  }

  const allArchived =
    selected.length > 0 && selected.every((n) => n.status === 'archived');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-sm">
          {plural(notebooks.length, 'notebook')} ·{' '}
          {plural(
            notebooks.reduce((sum, n) => sum + n.pageCount, 0),
            'page',
          )}
          {trash && ` · deleted for good after ${TRASH_DAYS} days`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          aria-pressed={selecting}
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
        >
          {selecting ? 'Done' : 'Select'}
        </Button>
      </div>
      <ul
        className={cn(
          'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5',
          selecting && 'pb-36 sm:pb-20',
        )}
      >
        {notebooks.map((notebook) => {
          const isPicked = picked.has(notebook.id);
          const cover = (
            <>
              <div
                className={cn(
                  'bg-muted relative aspect-[3/4] overflow-hidden rounded-md border',
                  isPicked && 'ring-primary ring-[3px] ring-offset-2',
                )}
              >
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
                {selecting && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-2 top-2 flex size-6 items-center justify-center rounded-md border-2 border-white shadow',
                      isPicked
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/25',
                    )}
                  >
                    {isPicked && <Check className="size-4" strokeWidth={3} />}
                  </span>
                )}
                {notebook.status === 'archived' && !trash && (
                  <span className="bg-background/85 text-muted-foreground absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-xs">
                    Archived
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{notebook.name}</p>
                <p className="text-muted-foreground text-xs">
                  {plural(notebook.pageCount, 'page')}
                  {notebook.trashedAt &&
                    ` · deleted in ${plural(daysLeftInTrash(notebook.trashedAt), 'day')}`}
                </p>
              </div>
            </>
          );
          const tile =
            'focus-visible:outline-ring group flex w-full flex-col gap-2 rounded-md text-left outline-offset-4 focus-visible:outline-2';
          return (
            <li key={notebook.id}>
              {selecting ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isPicked}
                  aria-label={notebook.name}
                  onClick={() => toggle(notebook.id)}
                  className={tile}
                >
                  {cover}
                </button>
              ) : (
                <Link
                  href={`/notebooks/${notebook.id}`}
                  prefetch={false}
                  className={tile}
                >
                  {cover}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && (
        <div
          role="toolbar"
          aria-label="Selected notebooks"
          className="bg-card fixed inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex flex-wrap items-center gap-2 rounded-xl border p-2 pl-3.5 shadow-lg sm:w-fit sm:max-w-[calc(100%-1rem)]"
        >
          <span
            className="text-sm font-semibold tabular-nums"
            aria-live="polite"
          >
            {selected.length} selected
          </span>
          {selected.length < notebooks.length && (
            <Button
              variant="link"
              size="xs"
              onClick={() => setPicked(new Set(notebooks.map((n) => n.id)))}
            >
              Select all
            </Button>
          )}
          <div
            className={cn(
              'order-last grid basis-full gap-1.5 sm:order-none sm:flex sm:basis-auto sm:gap-2',
              trash ? 'grid-cols-2' : 'grid-cols-4',
            )}
          >
            {trash ? (
              <Button
                variant="outline"
                size="sm"
                className={action}
                disabled={busy || selected.length === 0}
                onClick={() => void run('restore')}
              >
                {busy ? <Spinner /> : <RotateCcw aria-hidden />}
                Restore
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className={action}
                  disabled={busy || selected.length === 0}
                  onClick={() => void run(allArchived ? 'reopen' : 'archive')}
                >
                  {busy ? (
                    <Spinner />
                  ) : allArchived ? (
                    <ArchiveRestore aria-hidden />
                  ) : (
                    <Archive aria-hidden />
                  )}
                  {allArchived ? 'Reopen' : 'Archive'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={action}
                  disabled={busy || selected.length < 2}
                  onClick={() => setDialog('merge')}
                >
                  <Merge aria-hidden />
                  Merge…
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={action}
                  disabled={busy || selected.every((n) => n.pageCount === 0)}
                  onClick={exportPdfs}
                >
                  <FileDown aria-hidden />
                  Export PDF
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                action,
                'text-destructive border-destructive/40 hover:text-destructive',
              )}
              disabled={busy || selected.length === 0}
              onClick={() => setDialog('remove')}
            >
              <Trash2 aria-hidden />
              {trash ? 'Delete now…' : 'Delete…'}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto sm:order-last sm:ml-0"
            aria-label="Stop selecting (Esc)"
            onClick={stopSelecting}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}

      <RemoveNotebooksDialog
        notebooks={selected}
        open={dialog === 'remove'}
        onOpenChange={(open) => setDialog(open ? 'remove' : null)}
        onDone={finish}
      />
      <MergeNotebooksDialog
        notebooks={selected}
        open={dialog === 'merge'}
        onOpenChange={(open) => setDialog(open ? 'merge' : null)}
        onDone={finish}
      />
    </div>
  );
}
