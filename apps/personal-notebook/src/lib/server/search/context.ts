import {
  type Breaker,
  breaker,
  withQueryPriority,
} from '@rainforest-dev/search';

import { embedderFromEnv, searchDirFromEnv } from './env';

/** What page search needs: one embedder queue, the index folder and the timeout breaker. */
export type SearchContext = {
  embedders: ReturnType<typeof withQueryPriority> | undefined;
  dir: string | undefined;
  gate: Breaker;
};

let context: SearchContext | undefined;

export function searchContext(): SearchContext {
  if (!context) {
    const embedder = embedderFromEnv();
    context = {
      embedders: embedder ? withQueryPriority(embedder) : undefined,
      dir: searchDirFromEnv(),
      gate: breaker(),
    };
  }
  return context;
}
