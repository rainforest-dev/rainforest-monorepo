'use client';

import { type LibraryT, useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { useState } from 'react';

import { cn } from '@/lib';
import { TRASH_DAYS } from '@/lib/notebook';
import { NOTEBOOK_NAMESPACE } from '@/locales';
import type { NotebookBulkAction, NotebookSummary } from '@/types';

import { postNotebookBulk } from './api';

type Mode = Extract<NotebookBulkAction, 'archive' | 'trash' | 'delete'>;

export type RemovableNotebook = Pick<
  NotebookSummary,
  'id' | 'name' | 'status' | 'pageCount' | 'trashedAt'
>;

const names = (notebooks: readonly RemovableNotebook[], t: LibraryT) =>
  notebooks.length === 1
    ? notebooks[0].name
    : notebooks.length === 2
      ? t('remove.names.two', { a: notebooks[0].name, b: notebooks[1].name })
      : t('remove.names.more', {
          first: notebooks[0].name,
          count: notebooks.length - 1,
        });

/**
 * Asks how to take notebooks off the shelf: archive them, move them to Trash (the default), or
 * delete them now. Notebooks already in Trash only offer deleting now.
 */
export function RemoveNotebooksDialog({
  notebooks,
  open,
  onOpenChange,
  onDone,
}: {
  notebooks: readonly RemovableNotebook[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the action ran, with the ids it changed. */
  onDone: (mode: Mode, done: number[]) => void;
}) {
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const plural = (n: number) => t('merge.notebooks', { count: n });
  const inTrash = notebooks.every((n) => n.trashedAt !== null);
  const allArchived = notebooks.every((n) => n.status === 'archived');
  const modes: Mode[] = inTrash
    ? ['delete']
    : allArchived
      ? ['trash', 'delete']
      : ['archive', 'trash', 'delete'];
  const [chosen, setChosen] = useState<Mode>('trash');
  const mode = modes.includes(chosen) ? chosen : modes[0];
  const [busy, setBusy] = useState(false);
  const pages = notebooks.reduce((sum, n) => sum + n.pageCount, 0);
  const count = notebooks.length;

  const options: Record<Mode, { label: string; detail: string }> = {
    archive: {
      label: t('remove.archive'),
      detail: t('remove.archiveDetail'),
    },
    trash: {
      label: t('remove.trash'),
      detail: t('remove.trashDetail', { days: TRASH_DAYS }),
    },
    delete: {
      label: t('remove.delete'),
      detail:
        pages === 0
          ? t(count === 1 ? 'remove.deleteIt' : 'remove.deleteThem')
          : pages === 1
            ? t('remove.deletePage')
            : t('remove.deletePages', { count: pages }),
    },
  };

  async function submit() {
    setBusy(true);
    try {
      const { done, failed } = await postNotebookBulk(
        mode,
        notebooks.map((n) => n.id),
      );
      if (failed.length > 0) {
        toast.error(
          t('remove.notChanged', {
            notebooks: plural(failed.length),
            error: failed[0].error,
          }),
        );
      }
      if (done.length > 0) {
        toast.success(
          {
            archive: t('remove.archived', { notebooks: plural(done.length) }),
            trash: t('remove.trashed', { notebooks: plural(done.length) }),
            delete: t('remove.deleted', { notebooks: plural(done.length) }),
          }[mode],
        );
      }
      onDone(mode, done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(inTrash ? 'remove.titleDelete' : 'remove.titleRemove', {
              what: count === 1 ? notebooks[0]?.name : plural(count),
            })}
          </DialogTitle>
          <DialogDescription>
            {count > 1 && `${names(notebooks, t)} · `}
            {t('notebook.pages', { count: pages })}
          </DialogDescription>
        </DialogHeader>
        {modes.length > 1 ? (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-muted-foreground mb-2 text-xs font-medium">
              {t('remove.question')}
            </legend>
            {modes.map((value) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3.5',
                  mode === value &&
                    (value === 'delete'
                      ? 'border-destructive bg-destructive/5'
                      : 'border-primary bg-primary/5'),
                )}
              >
                <input
                  type="radio"
                  name="remove-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setChosen(value)}
                  className={cn(
                    'mt-0.5',
                    value === 'delete'
                      ? 'accent-destructive'
                      : 'accent-primary',
                  )}
                />
                <span className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      value === 'delete' && 'text-destructive',
                    )}
                  >
                    {options[value].label}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {options[value].detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-sm">{options.delete.detail}</p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant={mode === 'delete' ? 'destructive' : 'default'}
            disabled={busy || count === 0}
            onClick={() => void submit()}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {options[mode].label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
