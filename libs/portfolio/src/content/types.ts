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

export interface GalleryImage {
  /**
   * Public image URL of a real product screenshot, e.g.
   * `/images/portfolio/hoogii-wallet/dashboard.png`. Leave undefined to render
   * a labelled placeholder slide until a real screenshot is dropped in — the
   * `caption` then doubles as a note for what that slide should show.
   */
  src?: string;
  /** Alt text describing the screenshot (required for a11y). */
  alt: string;
  /** Short caption shown beneath the slide. */
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
  sections: Section[]; // exactly 5, each a distinct interaction kind
  /**
   * Optional product-screenshot gallery, shown as a carousel near the top of
   * the case study. Real images go under the consuming app's public dir; until
   * then, entries without `src` render as labelled placeholders.
   */
  gallery?: GalleryImage[];
}
