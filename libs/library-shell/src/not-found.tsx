'use client';

import {
  type CollectionId,
  collectionLabel,
  getCollection,
} from '@rainforest-dev/library-contract';

import { COLLECTION_ICONS } from './collection-nav';
import { useLibraryLocale, useLibraryT } from './i18n-provider';

const LINK =
  'border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium';

/**
 * What every collection shows for a page it does not have, inside its own bar: a way back to
 * the collection's front page and to the hall. The links are plain anchors, so it needs no
 * router and renders the same in a Next app and in an Astro page.
 */
export function LibraryNotFound({ current }: { current: CollectionId }) {
  const t = useLibraryT();
  const locale = useLibraryLocale();
  const HallIcon = COLLECTION_ICONS.hall;
  const OwnIcon = COLLECTION_ICONS[current];
  return (
    <section
      aria-labelledby="library-not-found"
      className="mx-auto flex max-w-xl flex-col items-start gap-4 py-16"
    >
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 id="library-not-found" className="text-2xl font-semibold">
        {t('notFound.title')}
      </h1>
      <p className="text-muted-foreground">{t('notFound.body')}</p>
      <div className="flex flex-wrap gap-2">
        {current !== 'hall' && (
          <a href={getCollection(current).basePath} className={LINK}>
            <OwnIcon aria-hidden className="size-4" />
            {t('notFound.toCollection', {
              name: collectionLabel(current, locale),
            })}
          </a>
        )}
        <a href={getCollection('hall').basePath} className={LINK}>
          <HallIcon aria-hidden className="size-4" />
          {t('notFound.toHall')}
        </a>
      </div>
    </section>
  );
}
