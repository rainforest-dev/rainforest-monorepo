import { cookies } from 'next/headers';

import { BookDetail } from '@/components/detail/BookDetail';
import { parseLibraryParams, type RawSearchParams } from '@/lib/library-params';
import {
  listBookDeliveryEvents,
  listDeliveryPlatforms,
} from '@/lib/server/delivery';
import {
  getBook,
  getFilterOptions,
  getLibraryBook,
} from '@/lib/server/queries';
import { applyTestHooks, FAULT_COOKIE, readTestHooks } from '@/lib/test-hooks';

export default async function PanePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const id = parseLibraryParams(raw).book;
  if (id === null) return null;
  await applyTestHooks(
    readTestHooks(raw, (await cookies()).get(FAULT_COOKIE)?.value),
    'pane',
  );
  const [book, library, events, platforms, options] = await Promise.all([
    getBook(id),
    getLibraryBook(id),
    listBookDeliveryEvents(id),
    listDeliveryPlatforms(),
    getFilterOptions(),
  ]);
  if (!book)
    return <p className="text-muted-foreground p-5 text-sm">Book not found.</p>;
  return (
    <BookDetail
      variant="pane"
      book={book}
      library={library}
      events={events}
      platforms={platforms}
      allTags={options.tags}
      currentParams={raw}
    />
  );
}
