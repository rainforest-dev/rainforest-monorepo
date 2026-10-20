import { cookies } from 'next/headers';

import { BookDetail } from '@/components/detail';
import {
  applyTestHooks,
  FAULT_COOKIE,
  parseLibraryParams,
  type RawSearchParams,
  readTestHooks,
} from '@/lib';
import {
  getBook,
  getFilterOptions,
  getLibraryBook,
  listBookDeliveryEvents,
  listDeliveryPlatforms,
} from '@/lib/server';
import { calibreT, pageLocale } from '@/locales';

export default async function PanePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const locale = await pageLocale(params);
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
    return (
      <p className="text-muted-foreground p-5 text-sm">
        {calibreT(locale)('detail.notFound')}
      </p>
    );
  return (
    <BookDetail
      variant="pane"
      book={book}
      library={library}
      events={events}
      platforms={platforms}
      allTags={options.tags}
      currentParams={raw}
      locale={locale}
    />
  );
}
