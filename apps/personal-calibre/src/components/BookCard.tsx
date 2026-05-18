import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BookSummary } from '@/types/calibre';

function platformAbbr(key: string): string {
  const map: Record<string, string> = { 'readwise-reader': 'RW', notebooklm: 'NLM' };
  return map[key] ?? key.slice(0, 3).toUpperCase();
}

interface Props {
  book: BookSummary;
  from?: string;
  selected?: boolean;
  onToggle?: () => void;
}

export function BookCard({ book, from, selected, onToggle }: Props) {
  const href = from
    ? `/books/${book.id}?from=${encodeURIComponent(from)}`
    : `/books/${book.id}`;

  const cardContent = (
    <Card
      data-testid="book-card"
      className={`h-full overflow-hidden transition-shadow group-hover:shadow-md ${selected ? 'ring-primary ring-2' : ''}`}
    >
      <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden">
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
        {onToggle !== undefined && (
          <div className="absolute left-2 top-2">
            <input type="checkbox" checked={selected ?? false} onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 cursor-pointer accent-primary"
              aria-label={`Select ${book.title}`} />
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
              <Badge key={fmt} variant="outline" className="px-1 py-0 text-[10px]">{fmt}</Badge>
            ))}
          </div>
        )}
        {book.deliveredTo.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-0.5">
            {book.deliveredTo.map((key) => (
              <span key={key} title={key}
                className="bg-primary/15 text-primary inline-flex items-center rounded px-1 py-0 text-[9px] font-medium uppercase tracking-wide">
                {platformAbbr(key)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (onToggle !== undefined) {
    return (
      <div className="group cursor-pointer" onClick={onToggle} role="checkbox"
        aria-checked={selected ?? false} tabIndex={0} onKeyDown={(e) => e.key === ' ' && onToggle()}>
        {cardContent}
      </div>
    );
  }

  return <Link href={href} className="group">{cardContent}</Link>;
}
