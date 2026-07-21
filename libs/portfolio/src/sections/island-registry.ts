import type { ComponentType } from 'react';

import type { InteractionKind } from '../content/types';
import { AffectedPipeline } from '../islands/affected-pipeline';
import { AmmQuote } from '../islands/amm-quote';
import { CasbinPlayground } from '../islands/casbin-playground';
import { EnvDeploy } from '../islands/env-deploy';
import { FetchThenStream } from '../islands/fetch-then-stream';
import { FuzzySearch } from '../islands/fuzzy-search';
import { I18nCard } from '../islands/i18n-card';
import { IdleLock } from '../islands/idle-lock';
import { JwtDecode } from '../islands/jwt-decode';
import { LiveLedger } from '../islands/live-ledger';
import { OfferState } from '../islands/offer-state';
import { OrderBook } from '../islands/order-book';
import { PatchVsRefetch } from '../islands/patch-vs-refetch';
import { PhiEncrypt } from '../islands/phi-encrypt';
import { PhraseGrid } from '../islands/phrase-grid';
import { RelayGate } from '../islands/relay-gate';
import { RoleShell } from '../islands/role-shell';
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
  'jwt-decode': JwtDecode,
  'role-shell': RoleShell,
  'casbin-playground': CasbinPlayground,
  'phi-encrypt': PhiEncrypt,
  'affected-pipeline': AffectedPipeline,
};

export function islandFor(kind: InteractionKind): ComponentType | undefined {
  return ISLANDS[kind];
}
