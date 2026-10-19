import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
import { CircleXIcon } from 'lucide-react';

import {
  articleAnchor,
  type QueueItem,
  rackShelves,
  type ReadingQueue,
  SOURCES_PATH,
} from '@/lib';
import { type FileLoad } from '@/lib/desk';

export interface RackShelvesProps {
  queue: FileLoad<ReadingQueue | null>;
}

function ArticleCard({ item }: { item: QueueItem }) {
  const minutes = item.sort.readingMinutes;
  return (
    <li id={articleAnchor(item.id)} className="flex scroll-mt-20">
      <a
        href={item.readerUrl}
        target="_blank"
        rel="noreferrer"
        className="bg-card text-card-foreground border-t-chart-2 hover:bg-accent focus-visible:ring-ring flex min-h-36 w-full flex-col gap-2 rounded-md border border-t-4 p-3 outline-none focus-visible:ring-2 [li:target>&]:ring-2"
      >
        <span className="text-muted-foreground text-xs">
          {item.siteName}
          {minutes > 0 && ` · ${minutes} min`}
        </span>
        <span className="font-semibold leading-snug">{item.title}</span>
        <span className="text-muted-foreground mt-auto text-xs">
          {item.why}
        </span>
        {item.decay === 'time-sensitive' && (
          <Badge variant="warning" className="self-start">
            Time-sensitive
          </Badge>
        )}
      </a>
    </li>
  );
}

/**
 * The reading queue as shelves of cards, one shelf per tier. Server-rendered with no client
 * code: each card opens the article in Reader.
 */
export function RackShelves({ queue }: RackShelvesProps) {
  if (!queue.ok)
    return (
      <Alert variant="destructive">
        <CircleXIcon />
        <AlertTitle>Couldn't read the reading queue</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>Reload after the vault finishes syncing.</p>
          <code className="bg-muted text-foreground break-all rounded px-1.5 py-0.5 font-mono text-xs">
            {queue.error}
          </code>
        </AlertDescription>
      </Alert>
    );

  const shelves = queue.data ? rackShelves(queue.data) : [];
  if (shelves.length === 0)
    return (
      <Empty className="border py-12">
        <EmptyHeader>
          <EmptyTitle>
            {queue.data
              ? 'Nothing on the rack'
              : 'No reading queue has been generated yet.'}
          </EmptyTitle>
          <EmptyDescription>
            {queue.data ? (
              'The last reading-queue run queued no items.'
            ) : (
              <>
                Run the <code className="text-primary">reading-queue</code>{' '}
                skill to build one.
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <div className="flex flex-col gap-8">
      {shelves.map((shelf) => {
        const headingId = `shelf-${shelf.tier}`;
        return (
          <section
            key={shelf.tier}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <h2
              id={headingId}
              className="flex items-baseline gap-2 text-base font-semibold"
            >
              {shelf.label}
              <span className="text-muted-foreground text-sm font-normal tabular-nums">
                {shelf.items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 border-b-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
              {shelf.items.map((item) => (
                <ArticleCard key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-muted-foreground text-sm">
        Sorted by the reading-queue skill. The full table, with the stale items,
        is under{' '}
        <a
          className="text-primary underline"
          href={`${SOURCES_PATH}?tab=queue`}
        >
          Sources → Queue
        </a>
        .
      </p>
    </div>
  );
}
