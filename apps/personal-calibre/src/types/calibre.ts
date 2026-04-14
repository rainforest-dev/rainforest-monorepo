export interface BookSummary {
  id: number;
  title: string;
  authorSort: string | null;
  hasCover: boolean | null;
  seriesIndex: number | null;
  authors: string[];
  series: string | null;
  formats: string[];
}

export interface BookDetail extends BookSummary {
  path: string;
  pubdate: string | null;
  description: string | null;
  rating: number | null;
  tags: string[];
  publisher: string | null;
  language: string | null;
  files: Array<{ format: string; name: string; size: number }>;
}

export interface FilterOptions {
  authors: Array<{ id: number; name: string | null; sort: string | null }>;
  tags: Array<{ id: number; name: string | null }>;
  series: Array<{ id: number; name: string | null }>;
}
