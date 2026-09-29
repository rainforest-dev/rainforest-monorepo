import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { BookDetail } from '@/components/detail/BookDetail';
import { BookDetailSkeleton } from '@/components/detail/BookDetailSkeleton';
import { listBookDeliveryEvents, listDeliveryPlatforms } from '@/lib/delivery';
import { getBook, getFilterOptions, getLibraryBook } from '@/lib/queries';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) return { title: 'Book Not Found — Personal Calibre Library' };
  return { title: `${book.title} — Personal Calibre Library` };
}

export default function BookPage(props: Props) {
  return (
    <Suspense fallback={<BookDetailSkeleton />}>
      <BookPageContent {...props} />
    </Suspense>
  );
}

async function BookPageContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId < 1) notFound();

  const [book, library, events, platforms, options] = await Promise.all([
    getBook(bookId),
    getLibraryBook(bookId),
    listBookDeliveryEvents(bookId),
    listDeliveryPlatforms(),
    getFilterOptions(),
  ]);
  if (!book) notFound();

  const back =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
      ? from
      : '/';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href={back}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>
      <BookDetail
        variant="page"
        book={book}
        library={library}
        events={events}
        platforms={platforms}
        allTags={options.tags}
        currentParams={{}}
      />
    </div>
  );
}
