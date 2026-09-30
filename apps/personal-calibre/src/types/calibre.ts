export interface BookSummary {
  id: number;
  title: string;
  authorSort: string | null;
  hasCover: boolean | null;
  seriesIndex: number | null;
  authors: string[];
  series: string | null;
  formats: string[];
  deliveredTo: string[];
}

export interface BookGroup {
  key: string;
  label: string;
  total: number;
  books: BookSummary[];
}

export interface BookDetail extends BookSummary {
  path: string;
  pubdate: string | null;
  description: string | null;
  rating: number | null;
  tags: string[];
  tagIds: Array<{ id: number; name: string }>;
  publisher: string | null;
  language: string | null;
  files: Array<{ format: string; name: string; size: number }>;
}

export interface FilterOptions {
  authors: Array<{ id: number; name: string | null; sort: string | null }>;
  tags: Array<{ id: number; name: string | null }>;
  series: Array<{ id: number; name: string | null }>;
}

export interface LibraryBook extends BookSummary {
  seriesId: number | null;
  authorIds: number[];
  tags: Array<{ id: number; name: string }>;
  pubdate: string | null;
}

export interface EntryGroupRef {
  key: string;
  label: string;
  total: number;
  offset: number;
  id: number | null;
}

export interface LibraryEntry {
  book: LibraryBook;
  group?: EntryGroupRef;
}

export interface LibraryResult {
  entries: LibraryEntry[];
  page: number;
  pageCount: number;
  matching: number;
  libraryTotal: number;
  matchingIds: number[];
}
