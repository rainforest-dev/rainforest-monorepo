export type NotebookStatus = 'active' | 'archived';

export interface Notebook {
  id: number;
  name: string;
  status: NotebookStatus;
  startedOn: string | null;
  endedOn: string | null;
  createdAt: string;
}

export interface NotebookSummary extends Notebook {
  pageCount: number;
  /** The first page by position, used as the cover. */
  coverPageId: number | null;
}

export interface NotebookPage {
  id: number;
  notebookId: number;
  position: number;
  pageNumber: number | null;
  pageDate: string | null;
  fileName: string;
  mimeType: string;
  bytes: number;
  transcription: string | null;
  transcribedAt: string | null;
  source: string | null;
  createdAt: string;
}

export interface NotebookDetail extends NotebookSummary {
  pages: NotebookPage[];
}

export interface SkippedPage {
  name: string;
  reason: string;
}

export interface AppendPagesResult {
  added: number[];
  skipped: SkippedPage[];
}

export interface PageTranscriptionInput {
  transcription: string;
  pageNumber?: number;
  pageDate?: string;
}

/** A notebook's page ids in order, before and after a change. */
export interface PageOrderChange {
  notebookId: number;
  before: number[];
  after: number[];
}

/** A page left out of a move because the target already holds the same image. */
export interface DroppedPage {
  pageId: number;
  duplicateOf: number;
}

export interface MovePagesResult {
  dryRun: boolean;
  moved: number[];
  /** Deleted rather than moved: the same bytes are already in the target notebook. */
  dropped: DroppedPage[];
  target: PageOrderChange;
  sources: PageOrderChange[];
}

export interface MergeNotebooksResult extends MovePagesResult {
  /** The source notebook, deleted once it is empty; `null` on a dry run. */
  deletedNotebookId: number | null;
}

export interface DeleteNotebookResult {
  dryRun: boolean;
  notebookId: number;
  deletedPageIds: number[];
}
