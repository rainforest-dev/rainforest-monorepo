import { ToolInputError } from '@rainforest-dev/mcp-kit';

import type { NotebookBulkAction } from '@/types';

import {
  deleteNotebook,
  mergeNotebooks,
  restoreNotebook,
  setNotebookStatus,
  trashNotebook,
} from './notebooks';

export interface NotebookBulkResult {
  /** Notebooks the action changed, merged sources included. */
  done: number[];
  /** Notebooks it could not change, each with why. */
  failed: { id: number; error: string }[];
}

/**
 * Runs one shelf action over several notebooks. Each notebook succeeds or fails alone, so one
 * missing id does not undo the rest. `merge` moves every notebook but `targetId` into it.
 */
export async function applyNotebookBulkAction(
  action: NotebookBulkAction,
  ids: readonly number[],
  { targetId }: { targetId?: number } = {},
): Promise<NotebookBulkResult> {
  if (
    action === 'merge' &&
    (targetId === undefined || !ids.includes(targetId))
  ) {
    throw new ToolInputError('Pick which selected notebook to merge into');
  }
  const result: NotebookBulkResult = { done: [], failed: [] };
  for (const id of new Set(ids)) {
    if (action === 'merge' && id === targetId) continue;
    try {
      const changed = await apply(action, id, targetId);
      if (changed) result.done.push(id);
      else result.failed.push({ id, error: 'Notebook not found' });
    } catch (error) {
      if (!(error instanceof ToolInputError)) throw error;
      result.failed.push({ id, error: error.message });
    }
  }
  return result;
}

async function apply(
  action: NotebookBulkAction,
  id: number,
  targetId: number | undefined,
): Promise<boolean> {
  switch (action) {
    case 'archive':
      return (await setNotebookStatus(id, 'archived')) !== null;
    case 'reopen':
      return (await setNotebookStatus(id, 'active')) !== null;
    case 'trash':
      return (await trashNotebook(id)) !== null;
    case 'restore':
      return (await restoreNotebook(id)) !== null;
    case 'delete':
      return (await deleteNotebook(id, { deletePages: true })) !== null;
    case 'merge':
      if (targetId === undefined) return false;
      await mergeNotebooks(id, targetId);
      return true;
  }
}
