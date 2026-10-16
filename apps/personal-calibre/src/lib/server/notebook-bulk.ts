import { ToolInputError } from '@rainforest-dev/mcp-kit';

import type { NotebookBulkAction } from '@/types';

import {
  deleteNotebook,
  getNotebook,
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
 * missing id or failed delete does not hide what was already done. `merge` moves every notebook but `targetId` into it.
 */
export async function applyNotebookBulkAction(
  action: NotebookBulkAction,
  ids: readonly number[],
  { targetId }: { targetId?: number } = {},
): Promise<NotebookBulkResult> {
  if (action === 'merge') {
    if (targetId === undefined || !ids.includes(targetId)) {
      throw new ToolInputError('Pick which selected notebook to merge into');
    }
    // Pages merged into a trashed notebook would vanish with it.
    if ((await getNotebook(targetId))?.trashedAt) {
      throw new ToolInputError(
        'Restore the notebook from Trash before merging into it',
      );
    }
  }
  const result: NotebookBulkResult = { done: [], failed: [] };
  for (const id of new Set(ids)) {
    if (action === 'merge' && id === targetId) continue;
    try {
      const changed = await apply(action, id, targetId);
      if (changed) result.done.push(id);
      else result.failed.push({ id, error: 'Notebook not found' });
    } catch (error) {
      // Earlier ids may already be deleted for good, so the caller must hear which ones.
      if (!(error instanceof ToolInputError)) {
        console.error(`[notebooks] ${action} ${id} failed`, error);
      }
      result.failed.push({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
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
