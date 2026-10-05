import { buttonVariants } from '@rainforest-dev/rainforest-react';
import { BookOpen, Star } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';

import {
  buildLibraryHref,
  cn,
  type ParamPatch,
  type RawSearchParams,
  sanitizeDescription,
  seriesLine,
  spineClass,
  staticDownloadUrl,
} from '@/lib';
import type {
  BookDeliveryEvent,
  BookDetail as BookDetailData,
  DeliveryPlatform,
  FilterOptions,
  LibraryBook,
} from '@/types';

import { DeliveryRows } from './DeliveryRows';
import { DownloadMenu } from './DownloadMenu';
import { PaneTopRow } from './PaneTopRow';
import { TagEditor } from './TagEditor';

interface Props {
  variant: 'pane' | 'page';
  book: BookDetailData;
  library: LibraryBook | null;
  events: BookDeliveryEvent[];
  platforms: DeliveryPlatform[];
  allTags: FilterOptions['tags'];
  currentParams: RawSearchParams;
}

export function BookDetail({
  variant,
  book,
  library,
  events,
  platforms,
  allTags,
  currentParams,
}: Props) {
  const inPane = variant === 'pane';
  const Title = inPane ? 'h2' : 'h1';
  const Section = inPane ? 'h3' : 'h2';
  const hrefFor = (patch: ParamPatch) =>
    buildLibraryHref(inPane ? currentParams : {}, patch);
  const stars = book.rating === null ? null : Math.round(book.rating / 2);
  const hasEpub = book.formats.some((f) => f.toUpperCase() === 'EPUB');
  const description = sanitizeDescription(book.description);
  const authorLinks = library
    ? library.authors.map((name, i) => ({
        name,
        id: library.authorIds[i] ?? null,
      }))
    : book.authors.map((name) => ({ name, id: null }));
  const linkProps = { replace: inPane, scroll: false } as const;
  const sectionHeading =
    'text-muted-foreground text-xs font-medium uppercase tracking-wide';

  return (
    <article
      data-book-detail={book.id}
      className={cn(
        'flex flex-col gap-6',
        inPane ? 'p-4 lg:p-5' : 'mx-auto w-full max-w-3xl',
      )}
    >
      {inPane && <PaneTopRow bookId={book.id} />}
      <header className="flex gap-4">
        <div
          className={cn(
            'relative aspect-[2/3] shrink-0 overflow-hidden rounded-md',
            inPane ? 'w-[92px] lg:w-[108px]' : 'w-[108px] sm:w-[160px]',
          )}
        >
          {book.hasCover ? (
            <img
              src={`/api/books/${book.id}/cover`}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className={cn('size-full', spineClass(book.id))} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {book.series &&
            (library?.seriesId ? (
              <Link
                href={hrefFor({ series: library.seriesId })}
                {...linkProps}
                className="text-muted-foreground w-fit text-sm hover:underline"
              >
                {seriesLine(book.series, book.seriesIndex)}
              </Link>
            ) : (
              <p className="text-muted-foreground text-sm">
                {seriesLine(book.series, book.seriesIndex)}
              </p>
            ))}
          <Title className="text-xl font-semibold leading-tight">
            {book.title}
          </Title>
          {authorLinks.length > 0 && (
            <p className="text-sm">
              {authorLinks.map((author, i) => (
                <Fragment key={`${author.name}-${i}`}>
                  {i > 0 && ', '}
                  {author.id !== null ? (
                    <Link
                      href={hrefFor({ author: author.id })}
                      {...linkProps}
                      className="hover:underline"
                    >
                      {author.name}
                    </Link>
                  ) : (
                    author.name
                  )}
                </Fragment>
              ))}
            </p>
          )}
          {stars !== null && (
            <p
              role="img"
              aria-label={`Rated ${stars} of 5`}
              className="text-chart-4 flex gap-0.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  aria-hidden
                  className={cn(
                    'size-4',
                    n <= stars ? 'fill-current' : 'opacity-35',
                  )}
                />
              ))}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {hasEpub && (
          <Link
            href={`/read/${book.id}`}
            className={buttonVariants({ size: 'sm' })}
          >
            <BookOpen aria-hidden />
            Read
          </Link>
        )}
        {book.files.length > 0 && (
          <DownloadMenu
            files={book.files.map((file) => ({
              format: file.format,
              size: file.size,
              href: staticDownloadUrl(book.path, file.name, file.format),
              fileName: `${file.name}.${file.format.toLowerCase()}`,
            }))}
          />
        )}
      </div>

      <section className="flex flex-col gap-2">
        <Section className={sectionHeading}>Tags</Section>
        <TagEditor bookId={book.id} tagIds={book.tagIds} allTags={allTags} />
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
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
        {book.formats.length > 0 && (
          <>
            <dt className="text-muted-foreground">Formats</dt>
            <dd className="font-mono text-xs">{book.formats.join(' · ')}</dd>
          </>
        )}
      </dl>

      <DeliveryRows
        bookId={book.id}
        platforms={platforms}
        events={events}
        headingAs={Section}
      />

      {description && (
        <section className="flex flex-col gap-2">
          <Section className={sectionHeading}>Description</Section>
          <div
            className="text-sm leading-relaxed [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </section>
      )}
    </article>
  );
}
