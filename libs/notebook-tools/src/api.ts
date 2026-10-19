/**
 * What the notebook tools need from the notebook store. personal-notebook's server functions
 * satisfy it as they are; the shapes below name only the fields the tools read.
 */
export interface ToolPage {
  id: number;
  position: number;
  pageNumber: number | null;
  pageDate: string | null;
  fileName: string;
  transcription: string | null;
}

export interface NotebookToolApi {
  listNotebooks(): Promise<
    Array<{ id: number; name: string; status: string; pageCount: number }>
  >;
  getNotebookPages(
    notebookId: number,
    range?: { from?: number; to?: number; limit?: number },
  ): Promise<ToolPage[] | null>;
  readPageFile(
    pageId: number,
  ): Promise<{ data: Buffer; mimeType: string } | null>;
  setPageTranscription(
    pageId: number,
    input: { transcription: string; pageNumber?: number; pageDate?: string },
  ): Promise<{ pageNumber: number | null; pageDate: string | null } | null>;
  renameNotebook(
    notebookId: number,
    name: string,
  ): Promise<{ id: number; name: string } | null>;
  reorderPages(
    notebookId: number,
    pageIds: number[],
    options: { dryRun?: boolean },
  ): Promise<object | null>;
  movePages(
    pageIds: number[],
    toNotebookId: number,
    options: { beforePageId?: number; afterPageId?: number; dryRun?: boolean },
  ): Promise<unknown>;
  mergeNotebooks(
    sourceNotebookId: number,
    targetNotebookId: number,
    options: { placement?: 'start' | 'end'; dryRun?: boolean },
  ): Promise<unknown>;
  deleteNotebook(
    notebookId: number,
    options: { deletePages?: boolean; dryRun?: boolean },
  ): Promise<unknown>;
}
