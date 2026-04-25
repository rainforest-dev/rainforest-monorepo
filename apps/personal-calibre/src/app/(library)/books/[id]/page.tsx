import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import sanitizeHtml from 'sanitize-html';

import { DeliveryTracker } from '@/components/DeliveryTracker';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { listBookDeliveryEvents, listDeliveryPlatforms } from '@/lib/delivery';
import { getBook } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) return { title: 'Book Not Found — Personal Calibre Library' };
  return { title: `${book.title} — Personal Calibre Library` };
}

export default function BookDetailPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl" />}>
      <BookDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BookDetailContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) notFound();

  const [book, platforms, deliveryEvents] = await Promise.all([
    getBook(bookId),
    listDeliveryPlatforms(),
    listBookDeliveryEvents(bookId),
  ]);

  if (!book) notFound();

  const safeDescription = book.description
    ? sanitizeHtml(book.description, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class'] },
      })
    : null;

  // Guard against open-redirect: only trust local paths.
  const backHref = from && from.startsWith('/') ? from : '/';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={backHref} className="text-muted-foreground hover:text-foreground text-sm">
        ← Back to library
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row">
        {book.hasCover && (
          <div className="shrink-0">
            <img
              src={`/api/books/${book.id}/cover`}
              alt={`Cover of ${book.title}`}
              loading="eager"
              className="h-64 w-44 rounded-md object-cover shadow-md"
            />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{book.title}</h1>
            {book.authors.length > 0 && (
              <p className="text-muted-foreground mt-1">{book.authors.join(', ')}</p>
            )}
            {book.series && (
              <p className="text-muted-foreground text-sm">
                {book.series}
                {book.seriesIndex ? ` #${book.seriesIndex}` : ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {book.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {book.publisher && (
              <>
                <dt className="text-muted-foreground">Publisher</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.pubdate && (
              <>
                <dt className="text-muted-foreground">Published</dt>
                <dd>{book.pubdate.slice(0, 10)}</dd>
              </>
            )}
            {book.language && (
              <>
                <dt className="text-muted-foreground">Language</dt>
                <dd>{book.language}</dd>
              </>
            )}
            {book.rating != null && (
              <>
                <dt className="text-muted-foreground">Rating</dt>
                <dd>{'★'.repeat(Math.floor(book.rating / 2))}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            {book.files.map(({ format, name }) => (
              <a
                key={format}
                href={`/api/books/${book.id}/download/${format.toLowerCase()}`}
                download={`${name}.${format.toLowerCase()}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Download {format}
              </a>
            ))}
          </div>

          <DeliveryTracker
            bookId={book.id}
            platforms={platforms}
            events={deliveryEvents}
          />
        </div>
      </div>

      {safeDescription && (
        <div className="prose prose-sm max-w-none">
          <h2 className="text-base font-semibold">Description</h2>
          <div dangerouslySetInnerHTML={{ __html: safeDescription }} />
        </div>
      )}
    </div>
  );
}
