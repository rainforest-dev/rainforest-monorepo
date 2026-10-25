/**
 * What the book tools need from the Calibre library. personal-calibre's server functions satisfy
 * it as they are; the tools pass their results on without reading them, so most return
 * `unknown`.
 */
export interface BookSearchParams {
  q?: string;
  authorId?: number;
  tagId?: number;
  seriesId?: number;
  platformKey?: string;
  delivered?: boolean;
  groupBy?: 'series' | 'tag' | 'author';
  sortBy?: 'title' | 'author' | 'pubdate' | 'added' | 'rating';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface BookToolApi {
  searchBookList(params: BookSearchParams): Promise<unknown>;
  getBook(id: number): Promise<unknown>;
  listUndeliveredBooks(params: {
    platformKey: string;
    page?: number;
    limit?: number;
  }): Promise<unknown>;
  listBookDeliveryEvents(bookId: number): Promise<unknown>;
  createBookDeliveryEvent(
    bookId: number,
    input: { platformKey: string; externalRef?: string; note?: string },
  ): Promise<void>;
  bulkCreateDeliveryEvents(
    bookIds: number[],
    input: { platformKey: string; note?: string },
  ): Promise<{ count: number }>;
  deleteBookDeliveryEvent(bookId: number, deliveryId: number): Promise<void>;
  getFilterOptions(): Promise<{ tags: unknown }>;
  getOrCreateTag(name: string): number;
  addTagToBook(bookId: number, tagId: number): void;
  removeTagFromBook(bookId: number, tagId: number): void;
  revalidateBookTagCache(bookId: number): void;
}
