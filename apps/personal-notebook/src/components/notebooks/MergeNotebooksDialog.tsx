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
import type { NotebookSummary } from '@/types';

import { postNotebookBulk } from './api';

type MergeableNotebook = Pick<NotebookSummary, 'id' | 'name' | 'pageCount'>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Merges the selected notebooks into one of them. The others' pages go to the end of the
 * chosen one, in shelf order, and the emptied notebooks are deleted.
 */
export function MergeNotebooksDialog({
  notebooks,
  open,
  onOpenChange,
  onDone,
}: {
  notebooks: readonly MergeableNotebook[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (done: number[]) => void;
}) {
  // The biggest notebook is the likeliest one to keep.
  const largest = notebooks.reduce<MergeableNotebook | undefined>(
    (best, n) => (best && best.pageCount >= n.pageCount ? best : n),
    undefined,
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const targetId =
    notebooks.find((n) => n.id === chosen)?.id ?? largest?.id ?? null;
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (targetId === null) return;
    setBusy(true);
    try {
      const { done, failed } = await postNotebookBulk(
        'merge',
        notebooks.map((n) => n.id),
        targetId,
      );
      if (failed.length > 0) {
        toast.error(
          `${plural(failed.length, 'notebook')} not merged: ${failed[0].error}`,
        );
      }
      if (done.length > 0) {
        const target = notebooks.find((n) => n.id === targetId)?.name;
        toast.success(
          `Merged ${plural(done.length, 'notebook')} into ${target}`,
        );
      }
      onDone(done);
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
            Merge {plural(notebooks.length, 'notebook')}
          </DialogTitle>
          <DialogDescription>
            The other notebooks&apos; pages move to the end of the one you keep,
            and the emptied notebooks are deleted. A page whose image is already
            in it is dropped.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted-foreground mb-2 text-xs font-medium">
            Keep
          </legend>
          {notebooks.map((n) => (
            <label
              key={n.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5',
                targetId === n.id && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="radio"
                name="merge-target"
                value={n.id}
                checked={targetId === n.id}
                onChange={() => setChosen(n.id)}
                className="accent-primary"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {n.name}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {plural(n.pageCount, 'page')}
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || targetId === null || notebooks.length < 2}
            onClick={() => void submit()}
          >
            {busy && <Spinner data-icon="inline-start" />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
