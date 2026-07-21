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

/**
 * Hashgreen DEX — five real interactive sections transcribed from the
 * portfolio case-study reference:
 * 1. virtualized-search  — windowed, fuzzy-searchable 500+ market list
 * 2. order-book          — bid/ask book with a reconciling offer tooltip
 * 3. fetch-then-stream   — REST hydrate, then a live Ably subscription
 * 4. wallet-state-machine — Goby/Hoogii/Chia connect via WalletStageEnum
 * 5. patch-vs-refetch    — order history: patch a row or refetch the page
 */
export type DexInteractionKind =
  | 'virtualized-search'
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
  /**
   * Prose that may contain markdown-style `code` spans naming real symbols.
   * Render via an inline-markdown step (backtick spans -> <code>), NOT set:html
   * on the raw string (that would print the literal backtick characters).
   */
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
