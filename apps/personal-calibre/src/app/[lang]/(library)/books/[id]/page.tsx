import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { BookDetail, BookDetailSkeleton } from '@/components/detail';
import {
  getBook,
  getFilterOptions,
  getLibraryBook,
  listBookDeliveryEvents,
  listDeliveryPlatforms,
} from '@/lib/server';
import { calibreT, pageLocale } from '@/locales';

interface Props {
  params: Promise<{ lang: string; id: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const t = calibreT(await pageLocale(params));
  const book = await getBook(Number(id));
  if (!book) return { title: t('meta.bookNotFound') };
  return { title: t('meta.book', { title: book.title }) };
}

export default function BookPage(props: Props) {
  return (
    <Suspense fallback={<BookDetailSkeleton />}>
      <BookPageContent {...props} />
    </Suspense>
  );
}

async function BookPageContent({ params }: Props) {
  const { id } = await params;
  const locale = await pageLocale(params);
  const t = calibreT(locale);
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('detail.back')}
      </Link>
      <BookDetail
        variant="page"
        book={book}
        library={library}
        events={events}
        platforms={platforms}
        allTags={options.tags}
        currentParams={{}}
        locale={locale}
      />
    </div>
  );
}
