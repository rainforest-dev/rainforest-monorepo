import { readFileSync } from 'node:fs';

import { parseReadingQueue, type ReadingQueue } from './readingQueue.js';
import { registryFilePath } from './registry.js';

/**
 * Returns null when the artifact has not been generated yet — that is an empty
 * state, not an error. Any other read failure (permissions, a directory in its
 * place) still throws.
 *
 * Server-only: this module imports node:fs, so never import it from a React
 * island.
 */
export function readReadingQueue(): ReadingQueue | null {
  const path = registryFilePath('reading-queue.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return parseReadingQueue(raw);
}
