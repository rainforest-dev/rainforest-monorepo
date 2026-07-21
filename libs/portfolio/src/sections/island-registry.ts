import type { ComponentType } from 'react';

import type { InteractionKind } from '../content/types';
import { FetchThenStream } from '../islands/fetch-then-stream';
import { FuzzySearch } from '../islands/fuzzy-search';
import { IdleLock } from '../islands/idle-lock';
import { LiveLedger } from '../islands/live-ledger';
import { OrderBook } from '../islands/order-book';
import { PatchVsRefetch } from '../islands/patch-vs-refetch';
import { PhraseGrid } from '../islands/phrase-grid';
import { RelayGate } from '../islands/relay-gate';
import { VirtualizedSearch } from '../islands/virtualized-search';
import { WalletStateMachine } from '../islands/wallet-state-machine';

const ISLANDS: Partial<Record<InteractionKind, ComponentType>> = {
  'phrase-grid': PhraseGrid,
  'fuzzy-search': FuzzySearch,
  'live-ledger': LiveLedger,
  'idle-lock': IdleLock,
  'relay-gate': RelayGate,
  'virtualized-search': VirtualizedSearch,
  'order-book': OrderBook,
  'fetch-then-stream': FetchThenStream,
  'wallet-state-machine': WalletStateMachine,
  'patch-vs-refetch': PatchVsRefetch,
};

export function islandFor(kind: InteractionKind): ComponentType | undefined {
  return ISLANDS[kind];
}
