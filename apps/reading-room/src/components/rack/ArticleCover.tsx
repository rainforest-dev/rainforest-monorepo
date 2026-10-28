import { NewspaperIcon } from 'lucide-react';

import { articleCoverHref, type QueueItem } from '@/lib';

/**
 * An article's cover: its picture when Reader or its page has one, over a cover drawn from its
 * site's name. Rendered on the server with no client code, so a picture that fails to load
 * leaves the drawn cover showing through rather than swapping it in.
 */
export function ArticleCover({ item }: { item: QueueItem }) {
  return (
    <span
      className="bg-muted text-muted-foreground relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden"
      data-cover={item.imageUrl ? 'image' : 'drawn'}
      aria-hidden
    >
      <NewspaperIcon className="size-12 opacity-60" />
      {item.siteName && (
        <span className="bg-background/90 text-foreground absolute bottom-2 left-3 max-w-[calc(100%-1.5rem)] truncate rounded px-1.5 py-0.5 text-xs font-medium">
          {item.siteName}
        </span>
      )}
      {item.imageUrl && (
        <img
          src={articleCoverHref(item.id)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
