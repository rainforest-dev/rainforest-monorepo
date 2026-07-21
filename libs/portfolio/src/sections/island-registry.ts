import type { ComponentType } from 'react';

import type { InteractionKind } from '../content/types';
import { FuzzySearch } from '../islands/fuzzy-search';
import { IdleLock } from '../islands/idle-lock';
import { LiveLedger } from '../islands/live-ledger';
import { PhraseGrid } from '../islands/phrase-grid';
import { RelayGate } from '../islands/relay-gate';

const ISLANDS: Partial<Record<InteractionKind, ComponentType>> = {
  'phrase-grid': PhraseGrid,
  'fuzzy-search': FuzzySearch,
  'live-ledger': LiveLedger,
  'idle-lock': IdleLock,
  'relay-gate': RelayGate,
};

export function islandFor(kind: InteractionKind): ComponentType | undefined {
  return ISLANDS[kind];
}
