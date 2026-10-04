import {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/server/delivery';
import {
  getBook,
  getBookList,
  getFilterOptions,
  getGroupedBookList,
  listUndeliveredBooks,
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
};
