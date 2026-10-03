import { useState } from 'react';

import type { Source, Topic } from '@/lib';
import {
  type DeskData,
  type DeskFile,
  fetchQueue,
  fetchSources,
  fetchTopics,
} from '@/lib/desk';

const FETCHERS: { [F in DeskFile]: () => Promise<DeskData[F]> } = {
  sources: fetchSources,
  topics: fetchTopics,
  queue: fetchQueue,
};

export function useDeskData(initial: DeskData) {
  const [data, setData] = useState(initial);
  const [retrying, setRetrying] = useState<ReadonlySet<DeskFile>>(new Set());

  function setRetry(file: DeskFile, on: boolean) {
    setRetrying((prev) => {
      const next = new Set(prev);
      if (on) next.add(file);
      else next.delete(file);
      return next;
    });
  }

  async function retry(file: DeskFile) {
    if (retrying.has(file)) return;
    setRetry(file, true);
    try {
      const result = await FETCHERS[file]();
      setData((prev) => ({ ...prev, [file]: result }));
    } finally {
      setRetry(file, false);
    }
  }

  function updateSources(update: (prev: Source[]) => Source[]) {
    setData((prev) =>
      prev.sources.ok
        ? {
            ...prev,
            sources: {
              ok: true,
              data: {
                ...prev.sources.data,
                sources: update(prev.sources.data.sources),
              },
            },
          }
        : prev,
    );
  }

  function updateTopics(update: (prev: Topic[]) => Topic[]) {
    setData((prev) =>
      prev.topics.ok
        ? {
            ...prev,
            topics: {
              ok: true,
              data: {
                ...prev.topics.data,
                topics: update(prev.topics.data.topics),
              },
            },
          }
        : prev,
    );
  }

  function markReadOnly(file: 'sources' | 'topics') {
    setData((prev) => {
      const load = prev[file];
      if (!load.ok) return prev;
      return {
        ...prev,
        [file]: { ok: true, data: { ...load.data, writable: false } },
      };
    });
  }

  return { data, retrying, retry, updateSources, updateTopics, markReadOnly };
}
