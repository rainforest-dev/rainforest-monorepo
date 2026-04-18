import type { BookSummary } from '@/types/calibre';

import { BookCard } from './BookCard';

interface Props {
  books: BookSummary[];
}

export function BookGrid({ books }: Props) {
  if (books.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center">
        No books found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
