import type { BookSummary } from '@/types/calibre';

import { BookCard } from './BookCard';

interface Props {
  books: BookSummary[];
  from?: Record<string, string | undefined>;
}

export function BookGrid({ books, from }: Props) {
  if (books.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center">
        No books found.
      </div>
    );
  }

  const fromParam = (() => {
    if (!from) return '/';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(from)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  })();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} from={fromParam} />
      ))}
    </div>
  );
}
