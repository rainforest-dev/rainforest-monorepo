import type { CaseStudy } from './types';

export const hashgreenSwap: CaseStudy = {
  slug: 'hashgreen-swap',
  variant: 'swap',
  title: 'HashgreenSwap',
  tagline:
    'The AMM swap interface for Chia CAT tokens, built on the Project Pyke exchange backend.',
  role: 'Frontend Engineer · Hashgreen Labs',
  period: '2023 – Present',
  stack: ['Next.js', 'Radix UI', 'Redux Toolkit', 'Nx'],
  sections: [
    {
      id: 'swapping-on-a-logarithmic-curve',
      title: 'Swapping on a logarithmic curve',
      feature:
        'Type an amount and get a live quote — minimum received, price impact, and fee — in either direction, exact-in or exact-out.',
      contribution:
        "I built the swap engine. I ported Pyke's AMM pricing out of the implementation paper into one pure function and wired both quote directions — exact-out inverts the same invariant, it isn't a second approximation.",
      tech: 'Pyke is not constant-product (`x·y=k`) — `calcUserSwap` in `utils/swap.ts` solves a log-space invariant with a pool fee `φ` and a safety margin `ε = 1e-5`; price impact is `|1 − actual/spot|`. The function runs client-side on every keystroke.',
      interaction: 'amm-quote',
      sourceRef: 'src/utils/swap.ts · src/hooks/useSwapQuote.ts',
    },
    {
      id: 'sign-once-settle-on-chain',
      title: 'Sign once, settle on-chain',
      feature:
        'Execute with no centralized order book: the browser assembles a signed Chia offer, the chain settles it, and the UI tracks it to confirmation.',
      contribution:
        'I unified three wallet backends behind one `IWallet.createOffer` interface — Goby, Hoogii, and Chia over WalletConnect — so the app never knows which wallet signed, and I built the recent-transaction tracker on top.',
      tech: 'A swap is a Chia `offer` signed with BLS keys in the wallet; the `CLVM` puzzle-reveal bundle is built client-side, then the offer walks `VALID → IN_MEMPOOL → ON_CHAIN` — `INVALID` means a coin it spent was used elsewhere first.',
      interaction: 'offer-state',
      sourceRef:
        'src/wallets/IWallet.ts · src/components/RecentTransactions.tsx',
    },
    {
      id: 'one-sided-liquidity-pool-share-math',
      title: 'One-sided liquidity, pool-share math',
      feature:
        'Add liquidity — including Zap, a single-asset deposit — with share-of-pool and LP minted shown as you type.',
      contribution:
        'I built the liquidity forms and the paired-input hook that locks the two deposits to the pool ratio, then the Zap toggle that collapses them into one input for single-sided deposits.',
      tech: 'In balanced mode `useAssetInputPair` pins the other side to the reserve ratio; Zap converts part of one asset before minting — which is why the backend counts `add_liquidity` and `add_liquidity_zap` as distinct tx types.',
      interaction: 'zap-liquidity',
      sourceRef:
        'src/hooks/useAssetInputPair.ts · src/components/LiquidityPanel.tsx',
    },
    {
      id: 'shipping-it-one-image-four-environments',
      title: 'Shipping it: one image, four environments',
      feature:
        'One container image is promoted through sandbox → UAT → staging → prod on Kubernetes, each with its own config and autoscaling.',
      contribution:
        "I owned delivery — the multi-stage Dockerfile that ships Next's standalone output as a non-root container, the Helm chart with per-env values, and the GitHub Actions that build, push, and helm-upgrade.",
      tech: "The build is `base → deps → builder → runner` on `node:20-alpine`; an `ARG` selects `.env.{uat|stg|sandbox|prod}`, `output: 'standalone'` keeps the image tiny, and the runner drops to uid 1001.",
      interaction: 'env-deploy',
      sourceRef:
        'Dockerfile · chart/values.{env}.yaml · .github/workflows/deploy.yml',
    },
    {
      id: 'one-library-three-languages',
      title: 'One library, three languages',
      feature:
        'Every page reuses the same primitives and tokens, and the UI switches EN / Simplified / Traditional Chinese at runtime — no reload.',
      contribution:
        'I built the shared `@hashgreen/ui-libraries` package the app consumes, and wired `next-i18next` with a chained backend so a language flips in place without a round-trip.',
      tech: 'Language runs through `i18next-chained-backend` — localStorage first, HTTP second — with per-namespace JSON in `public/locales/{en,zh-CN,zh-TW}`, and the color and text tokens live once in the shared package.',
      interaction: 'i18n-card',
      sourceRef:
        'libs/ui-libraries/pyke · next-i18next.config.js · public/locales/',
    },
  ],
  // Real product screenshot, in apps/personal-website/public/images/portfolio/hashgreen-swap/.
  gallery: [
    {
      src: '/images/portfolio/hashgreen-swap/01.jpeg',
      alt: 'HashgreenSwap swap-confirm flow with the swap summary and the Hoogii wallet signature request',
      caption: 'Swap confirm & wallet signature',
    },
  ],
};
