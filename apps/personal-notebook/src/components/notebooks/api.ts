import { withBase } from '@/lib';
import type { NotebookBulkAction } from '@/types';

export const pageImageUrl = (pageId: number) =>
  withBase(`/api/notebooks/pages/${pageId}/image`);

export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export const notebookPdfUrl = (notebookId: number) =>
  withBase(`/api/notebooks/${notebookId}/pdf`);

export interface NotebookBulkResponse {
  done: number[];
  failed: { id: number; error: string }[];
}

/** Runs a shelf action over several notebooks; throws with the server's message on a 4xx/5xx. */
export async function postNotebookBulk(
  action: NotebookBulkAction,
  ids: readonly number[],
  targetId?: number,
): Promise<NotebookBulkResponse> {
  const response = await fetch(withBase('/api/notebooks/bulk'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ids, targetId }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Could not update notebooks'));
  }
  return (await response.json()) as NotebookBulkResponse;
}
