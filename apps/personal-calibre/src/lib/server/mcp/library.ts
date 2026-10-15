import {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/server/delivery';
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
import {
  getBook,
  getBookList,
  getFilterOptions,
  getGroupedBookList,
  listUndeliveredBooks,
  searchBookList,
} from '@/lib/server/queries';
import {
  addTagToBook,
  getOrCreateTag,
  removeTagFromBook,
  revalidateBookTagCache,
} from '@/lib/server/tags';

import type { CalibreLibrary } from './tools';

export const liveLibrary: CalibreLibrary = {
  getBookList,
  getGroupedBookList,
  searchBookList,
  getBook,
  listUndeliveredBooks,
  listBookDeliveryEvents,
  createBookDeliveryEvent,
  bulkCreateDeliveryEvents,
  deleteBookDeliveryEvent,
  getFilterOptions,
  getOrCreateTag,
  addTagToBook,
  removeTagFromBook,
  revalidateBookTagCache,
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
