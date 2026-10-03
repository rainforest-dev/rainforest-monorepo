import { type DeskData, type FileLoad, loadFailure } from '@/lib/desk';

import { readReadingQueue } from './readingQueueFile.js';
import {
  duplicateNameWarnings,
  isWritable,
  readSources,
  readTopics,
  SOURCES_FILE,
  TOPICS_FILE,
} from './registry.js';

function attempt<T>(read: () => T): FileLoad<T> {
  try {
    return { ok: true, data: read() };
  } catch (err) {
    return loadFailure(err);
  }
}

export function readDeskData(): DeskData {
  return {
    sources: attempt(() => {
      const sources = readSources();
      return {
        sources,
        writable: isWritable(SOURCES_FILE),
        warnings: duplicateNameWarnings(sources),
      };
    }),
    topics: attempt(() => {
      const topics = readTopics();
      return {
        topics,
        writable: isWritable(TOPICS_FILE),
        warnings: duplicateNameWarnings(topics),
      };
    }),
    queue: attempt(readReadingQueue),
  };
}
