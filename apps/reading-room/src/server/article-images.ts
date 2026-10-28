import { type ReadingQueue } from '@/lib';

import { pagePictures } from './event-images.js';
import { readReadingQueue } from './readingQueueFile.js';

/**
 * The queue with each article's picture: Reader's own when the queue carries one, otherwise the
 * `og:image` of the article's page once that page has been read in the background.
 */
export function withArticleImages(
  queue: ReadingQueue | null,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  options: { allowPrivate?: boolean } = {},
): ReadingQueue | null {
  if (!queue) return queue;
  const pictures = pagePictures(
    queue.queue.map((item) => ({
      id: item.id,
      page: item.imageUrl ? undefined : item.sourceUrl,
    })),
    fetcher,
    now,
    options,
  );
  return {
    ...queue,
    queue: queue.queue.map((item) => {
      const imageUrl = item.imageUrl ?? pictures.get(item.id);
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  };
}

/** The reading queue from disk, with the pictures known so far. */
export function readReadingQueueWithImages(
  env: Record<string, string | undefined> = process.env,
): ReadingQueue | null {
  return withArticleImages(readReadingQueue(), fetch, Date.now(), {
    allowPrivate: env['EVENTS_PAGES_PRIVATE']?.trim() === 'allow',
  });
}
