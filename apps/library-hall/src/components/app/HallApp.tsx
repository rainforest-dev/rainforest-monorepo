'use client';

import {
  type CollectionId,
  collectionLabel,
  COLLECTIONS,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import {
  CollectionTabBar,
  openLibraryChannel,
  ShellLayout,
  useLibraryLocale,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import { Alert, AlertTitle, Button } from '@rainforest-dev/rainforest-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HallSkeleton } from '@/components/hall';
import { useIsDesktop } from '@/hooks';
import { toHallBooks } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { HallProvider, useHall } from '@/providers';

import { HallHeader } from './HallHeader';
import { HallRegion, type SourceNotice } from './HallRegion';
import {
  type HallItemsPayload,
  readItemsCache,
  writeItemsCache,
} from './items-cache';
import { StudyRegion } from './StudyRegion';

const labelOf = (id: string, locale: LibraryLocale) => {
  const collection = COLLECTIONS.find((c) => c.id === (id as CollectionId));
  return collection ? collectionLabel(collection, locale) : id;
};

function HallScreen({ missing }: { missing: readonly SourceNotice[] }) {
  const { bookcase } = useHall();
  return bookcase ? (
    <StudyRegion key={bookcase.key} bookcase={bookcase} />
  ) : (
    <HallRegion missing={missing} />
  );
}

/**
 * The hall's client: it loads every collection's shelf from `/api/items`, shows the last copy
 * from this tab at once, and refetches when another tab says a collection changed.
 */
export function HallApp() {
  const isDesktop = useIsDesktop();
  const locale = useLibraryLocale();
  const t = useLibraryT(HALL_NAMESPACE);
  const [payload, setPayload] = useState<HallItemsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const loading = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loading.current?.abort();
    const controller = new AbortController();
    loading.current = controller;
    try {
      const response = await fetch('/api/items', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const next = (await response.json()) as HallItemsPayload;
      setPayload(next);
      setFailed(false);
      writeItemsCache(next);
    } catch (error) {
      if (!controller.signal.aborted) setFailed(true);
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    const cached = readItemsCache();
    if (cached) setPayload(cached);
    void load();
    return () => loading.current?.abort();
  }, [load]);

  // An open BroadcastChannel can keep a page out of the bfcache, so the channel closes while
  // the page is hidden and reopens when it is shown again.
  useEffect(() => {
    let channel: ReturnType<typeof openLibraryChannel> | null = null;
    const open = () => {
      channel ??= openLibraryChannel((message) => {
        if (message.type === 'items-changed') void load();
      });
    };
    const close = () => {
      channel?.close();
      channel = null;
    };
    const onShow = (event: PageTransitionEvent) => {
      open();
      if (event.persisted) {
        setRestored(true);
        void load();
      }
    };
    open();
    window.addEventListener('pagehide', close);
    window.addEventListener('pageshow', onShow);
    return () => {
      close();
      window.removeEventListener('pagehide', close);
      window.removeEventListener('pageshow', onShow);
    };
  }, [load]);

  const books = useMemo(
    () => (payload ? toHallBooks(payload.items) : []),
    [payload],
  );
  const missing = useMemo(
    () =>
      (payload?.sources ?? [])
        .filter((s) => !s.ok)
        .map((s) => ({
          collection: s.collection,
          label: labelOf(s.collection, locale),
        })),
    [payload, locale],
  );

  let content;
  if (payload && books.length > 0) {
    content = (
      <HallProvider books={books}>
        <HallScreen missing={missing} />
      </HallProvider>
    );
  } else if (payload || failed) {
    content = (
      <Alert data-hall-empty className="my-6">
        <AlertTitle>
          {failed && !payload
            ? t('empty.failed')
            : missing.length > 0
              ? t('empty.missing', {
                  names: missing
                    .map((m) => m.label)
                    .join(t('shell:list.separator')),
                })
              : t('empty.none')}
        </AlertTitle>
        <div className="col-start-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t('empty.reload')}
          </Button>
        </div>
      </Alert>
    );
  } else {
    content = <HallSkeleton />;
  }

  return (
    <ShellLayout
      header={<HallHeader />}
      isDesktop={isDesktop}
      data-hall-app
      data-hall-restored={restored ? 'bfcache' : undefined}
    >
      {content}
      <CollectionTabBar current="hall" resume />
    </ShellLayout>
  );
}
