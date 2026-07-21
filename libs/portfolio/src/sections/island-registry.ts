import type { ComponentType } from 'react';

import type { InteractionKind } from '../content/types';
import { AmmQuote } from '../islands/amm-quote';
import { EnvDeploy } from '../islands/env-deploy';
import { FetchThenStream } from '../islands/fetch-then-stream';
import { FuzzySearch } from '../islands/fuzzy-search';
import { I18nCard } from '../islands/i18n-card';
import { IdleLock } from '../islands/idle-lock';
import { LiveLedger } from '../islands/live-ledger';
import { OfferState } from '../islands/offer-state';
import { OrderBook } from '../islands/order-book';
import { PatchVsRefetch } from '../islands/patch-vs-refetch';
import { PhraseGrid } from '../islands/phrase-grid';
import { RelayGate } from '../islands/relay-gate';
import { VirtualizedSearch } from '../islands/virtualized-search';
import { WalletStateMachine } from '../islands/wallet-state-machine';
import { ZapLiquidity } from '../islands/zap-liquidity';

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
  'amm-quote': AmmQuote,
  'offer-state': OfferState,
  'zap-liquidity': ZapLiquidity,
  'env-deploy': EnvDeploy,
  'i18n-card': I18nCard,
};

export function islandFor(kind: InteractionKind): ComponentType | undefined {
  return ISLANDS[kind];
}
