export type ProjectVariant = 'hoogii' | 'dex' | 'swap' | 'opencgt';

/**
 * Hoogii Wallet — five real interactive sections transcribed from the
 * portfolio case-study reference:
 * 1. phrase-grid   — 12-cell backup-phrase grid
 * 2. fuzzy-search  — fuzzy search over the CAT/token list
 * 3. live-ledger   — live/real-time updating transaction ledger
 * 4. idle-lock     — idle auto-lock
 * 5. relay-gate    — dApp messaging relay/gate
 */
export type HoogiiInteractionKind =
  | 'phrase-grid'
  | 'fuzzy-search'
  | 'live-ledger'
  | 'idle-lock'
  | 'relay-gate';

/** Hashgreen DEX — placeholder kinds; refined in later tasks. */
export type DexInteractionKind =
  | 'virtualized-list'
  | 'order-book'
  | 'fetch-then-stream'
  | 'wallet-state-machine'
  | 'patch-vs-refetch';

/** HashgreenSwap — placeholder kinds; refined in later tasks. */
export type SwapInteractionKind =
  | 'curve-swap'
  | 'sign-and-settle'
  | 'pool-share-math'
  | 'multi-env-deploy'
  | 'shared-lib-i18n';

/** OpenCGT — placeholder kinds; refined in later tasks. */
export type OpencgtInteractionKind =
  | 'role-aware-token'
  | 'multi-tenant-deploy'
  | 'casbin-playground'
  | 'client-side-encryption'
  | 'incremental-build';

export type InteractionKind =
  | HoogiiInteractionKind
  | DexInteractionKind
  | SwapInteractionKind
  | OpencgtInteractionKind;

export interface Section {
  id: string;
  title: string;
  feature: string;
  contribution: string; // first-person
  tech: string;
  interaction: InteractionKind;
  sourceRef?: string;
}

export interface CaseStudy {
  slug: string;
  variant: ProjectVariant;
  title: string;
  tagline: string;
  role: string;
  period: string;
  stack: string[];
  sections: Section[]; // exactly 5, each a distinct interaction kind
}
