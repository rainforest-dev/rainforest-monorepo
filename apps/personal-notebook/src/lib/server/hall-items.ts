import { type HallItem } from '@rainforest-dev/library-contract';
import { fnv1a } from '@rainforest-dev/search';

import { withBase } from '@/lib/base-path';
import type { NotebookSummary } from '@/types';

import { listNotebooks } from './notebooks';

/**
 * Cover cloths a paper notebook comes in. A notebook has no colour of its own yet, so its name
 * picks one, and the same notebook keeps its colour on every shelf.
 */
export const NOTEBOOK_COLORS = [
  '#2f4858',
  '#7a3b2e',
  '#3d5a3a',
  '#5b4a7a',
  '#8a6d2f',
  '#2e5e6e',
  '#6e2f4f',
  '#4a4a4a',
] as const;

export const notebookColor = (name: string): string =>
  NOTEBOOK_COLORS[Number.parseInt(fnv1a(name), 16) % NOTEBOOK_COLORS.length] ??
  NOTEBOOK_COLORS[0];

/** When a notebook belongs: when it was started, else when it was added. */
const dateOf = (notebook: NotebookSummary) =>
  notebook.startedOn ?? notebook.createdAt;

export function toHallItem(notebook: NotebookSummary): HallItem {
  return {
    kind: 'notebook',
    id: String(notebook.id),
    title: notebook.name,
    color: notebookColor(notebook.name),
    // The hall can sort by `month:` only; under its other groupings the notebooks share one case.
    groups: [
      `status:${notebook.status}`,
      `year:${dateOf(notebook).slice(0, 4)}`,
      ...(/^\d{4}-\d{2}/.test(dateOf(notebook))
        ? [`month:${dateOf(notebook).slice(0, 7)}`]
        : []),
    ],
    href: withBase(`/${notebook.id}`),
  };
}

/** Every notebook on the shelf, as the hall shelves it. Trash stays out. */
export async function notebookHallItems(): Promise<HallItem[]> {
  return (await listNotebooks()).map(toHallItem);
}
