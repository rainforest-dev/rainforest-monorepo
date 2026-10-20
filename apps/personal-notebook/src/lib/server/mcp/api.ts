import type { NotebookToolApi } from '@rainforest-dev/notebook-tools';

import {
  deleteNotebook,
  getNotebookPages,
  listNotebooks,
  mergeNotebooks,
  movePages,
  readPageFile,
  renameNotebook,
  reorderPages,
  setPageTranscription,
} from '@/lib/server/notebooks';

export const liveNotebookApi: NotebookToolApi = {
  listNotebooks,
  getNotebookPages,
  readPageFile,
  setPageTranscription,
  renameNotebook,
  reorderPages,
  movePages,
  mergeNotebooks,
  deleteNotebook,
};
