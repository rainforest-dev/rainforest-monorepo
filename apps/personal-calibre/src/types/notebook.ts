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
