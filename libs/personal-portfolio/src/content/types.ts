export type ProjectVariant = 'hoogii' | 'dex' | 'swap' | 'opencgt';

/**
 * The colour scheme a case-study page renders in, matching the real product's
 * design language:
 * - `dark`  — force dark (e.g. the Hoogii wallet / HashgreenSwap, dark-only UIs)
 * - `light` — force light
 * - `system` (default) — follow the visitor's OS preference (products that
 *   themselves support light *and* dark, e.g. Hashgreen DEX)
 */
export type ProjectTheme = 'dark' | 'light' | 'system';

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

/**
 * HashgreenSwap (Pyke) — five real interactive sections transcribed from the
 * portfolio case-study reference:
 * 1. amm-quote      — live exact-in/exact-out quote over the log-space
 *                     `calcUserSwap` AMM invariant, with slippage + math
 * 2. offer-state     — a Chia offer walking VALID → IN_MEMPOOL → ON_CHAIN
 *                     (or INVALID), signed via `IWallet.createOffer`
 * 3. zap-liquidity   — one-sided Zap deposit vs. balanced `useAssetInputPair`,
 *                     with live pool-share/LP math
 * 4. env-deploy      — one image promoted through sandbox/UAT/staging/prod,
 *                     with the real TVL/volume/txn metrics
 * 5. i18n-card       — a swap-summary card re-rendering in EN/简/繁 through
 *                     `i18next-chained-backend`
 */
export type SwapInteractionKind =
  | 'amm-quote'
  | 'offer-state'
  | 'zap-liquidity'
  | 'env-deploy'
  | 'i18n-card';

/**
 * OpenCGT — five real interactive sections transcribed from the portfolio
 * case-study reference (cell & gene therapy supply-chain / treatment
 * orchestration admin platform — NOT a carbon-credit platform):
 * 1. jwt-decode         — persona pick + `getRolesFromJwt()` decode-and-reveal
 * 2. role-shell          — hospital/manufacturer/root shell re-skin + 404 gate
 * 3. casbin-playground   — compose-and-enforce policy playground
 * 4. phi-encrypt         — cosmetic hybrid AES/RSA-OAEP encrypt + phi/non-phi reveal
 * 5. affected-pipeline   — nx-affected project-graph pipeline + Playwright/k6
 */
export type OpencgtInteractionKind =
  | 'jwt-decode'
  | 'role-shell'
  | 'casbin-playground'
  | 'phi-encrypt'
  | 'affected-pipeline';

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

/** Prop shape for the shared Gallery carousel. The gallery *data* is owned by
 *  @rainforest-dev/personal-data (getProjectGallery); this is just the component
 *  contract, structurally compatible with personal-data's GalleryImage. */
export interface GalleryImage {
  src?: string;
  alt: string;
  caption?: string;
}

export interface CaseStudy {
  slug: string;
  variant: ProjectVariant;
  title: string;
  tagline: string;
  role: string;
  period: string;
  stack: string[];
  /** Colour scheme the case-study page renders in. Defaults to `system`. */
  theme?: ProjectTheme;
  sections: Section[]; // exactly 5, each a distinct interaction kind
}

export type Locale = 'en' | 'zh';

/**
 * A per-locale overlay for a case study's translatable prose. English (in each
 * project's `content.ts`) is the base; a translation supplies only the fields
 * it localizes and anything omitted falls back to English (see getCaseStudy /
 * listCaseStudies). Sections are matched by their stable `id`, so reordering or
 * rewording English never silently mismatches a translation. Conventions:
 * product names (`title`) and code spans inside `tech` stay in English.
 */
export interface SectionTranslation {
  title?: string;
  feature?: string;
  contribution?: string;
  tech?: string;
}
export interface CaseStudyTranslation {
  tagline?: string;
  role?: string;
  period?: string;
  /** Keyed by Section.id. */
  sections?: Record<string, SectionTranslation>;
}
