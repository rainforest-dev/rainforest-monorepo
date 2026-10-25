import { bookTools } from '@rainforest-dev/book-tools';
import type { McpTool } from '@rainforest-dev/mcp-kit';

import type {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/server/delivery';
import type {
  getBook,
  getBookList,
  getFilterOptions,
  getGroupedBookList,
  listUndeliveredBooks,
  searchBookList,
} from '@/lib/server/queries';
import type {
  addTagToBook,
  getOrCreateTag,
  removeTagFromBook,
  revalidateBookTagCache,
} from '@/lib/server/tags';

export type CalibreLibrary = {
  getBookList: typeof getBookList;
  getGroupedBookList: typeof getGroupedBookList;
  searchBookList: typeof searchBookList;
  getBook: typeof getBook;
  listUndeliveredBooks: typeof listUndeliveredBooks;
  listBookDeliveryEvents: typeof listBookDeliveryEvents;
  createBookDeliveryEvent: typeof createBookDeliveryEvent;
  bulkCreateDeliveryEvents: typeof bulkCreateDeliveryEvents;
  deleteBookDeliveryEvent: typeof deleteBookDeliveryEvent;
  getFilterOptions: typeof getFilterOptions;
  getOrCreateTag: typeof getOrCreateTag;
  addTagToBook: typeof addTagToBook;
  removeTagFromBook: typeof removeTagFromBook;
  revalidateBookTagCache: typeof revalidateBookTagCache;
};

export { addDeliveryInputSchema } from '@rainforest-dev/book-tools';

/**
 * The book tools, then `notebooks`: the notebook tools now run in personal-notebook, and calibre
 * serves them forwarded (see `notebookToolsFromEnv`) so clients keep one server.
 */
export const calibreTools = (
  library: CalibreLibrary,
  notebooks: readonly McpTool[] = [],
): McpTool[] => [...bookTools(library), ...notebooks];
