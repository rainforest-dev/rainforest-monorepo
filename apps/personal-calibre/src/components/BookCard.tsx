import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BookSummary } from '@/types/calibre';

interface Props {
  book: BookSummary;
}

export function BookCard({ book }: Props) {
  return (
    <Link href={`/books/${book.id}`} className="group">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="bg-muted aspect-[2/3] w-full overflow-hidden">
          {book.hasCover ? (
            <img
              src={`/api/books/${book.id}/cover`}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-4xl">
              📚
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
          {book.authors.length > 0 && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {book.authors.join(', ')}
            </p>
          )}
          {book.series && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs italic">
              {book.series}
              {book.seriesIndex ? ` #${book.seriesIndex}` : ''}
            </p>
          )}
          {book.formats.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {book.formats.map((fmt) => (
                <Badge key={fmt} variant="outline" className="px-1 py-0 text-[10px]">
                  {fmt}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
