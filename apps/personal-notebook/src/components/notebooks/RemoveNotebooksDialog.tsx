'use client';

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
import type { NotebookBulkAction, NotebookSummary } from '@/types';

import { postNotebookBulk } from './api';

type Mode = Extract<NotebookBulkAction, 'archive' | 'trash' | 'delete'>;

export type RemovableNotebook = Pick<
  NotebookSummary,
  'id' | 'name' | 'status' | 'pageCount' | 'trashedAt'
>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const names = (notebooks: readonly RemovableNotebook[]) =>
  notebooks.length <= 2
    ? notebooks.map((n) => n.name).join(' and ')
    : `${notebooks[0].name} and ${notebooks.length - 1} more`;

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
      label: 'Archive',
      detail:
        'Marks them finished. They stay on the shelf under Archived and can be reopened any time.',
    },
    trash: {
      label: 'Move to Trash',
      detail: `Hidden everywhere, including search and the calendar. Restore from Trash within ${TRASH_DAYS} days; after that the pages and images are deleted.`,
    },
    delete: {
      label: 'Delete now',
      detail: `${
        pages === 0
          ? `Deletes ${count === 1 ? 'it' : 'them'}`
          : pages === 1
            ? 'Deletes the page and its image'
            : `Deletes all ${plural(pages, 'page')} and their images`
      } immediately. This cannot be undone.`,
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
          `${plural(failed.length, 'notebook')} not changed: ${failed[0].error}`,
        );
      }
      if (done.length > 0) {
        toast.success(
          {
            archive: `Archived ${plural(done.length, 'notebook')}`,
            trash: `Moved ${plural(done.length, 'notebook')} to Trash`,
            delete: `Deleted ${plural(done.length, 'notebook')}`,
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
            {inTrash ? 'Delete' : 'Remove'}{' '}
            {count === 1 ? notebooks[0]?.name : plural(count, 'notebook')}?
          </DialogTitle>
          <DialogDescription>
            {count > 1 && `${names(notebooks)} · `}
            {plural(pages, 'page')}
          </DialogDescription>
        </DialogHeader>
        {modes.length > 1 ? (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-muted-foreground mb-2 text-xs font-medium">
              What should happen
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
            Cancel
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
