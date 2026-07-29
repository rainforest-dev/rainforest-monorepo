export interface GalleryImage {
  /** Public URL of the screenshot (served from the app's /images/portfolio/). */
  src: string;
  /** Alt text describing the screenshot. */
  alt: string;
  /** Short caption shown beneath the slide. */
  caption?: string;
}

/**
 * Product-screenshot galleries, keyed by project slug — the single source of
 * truth for both the site's case-study carousels and the MCP `get_case_study`
 * output. The image files live in `src/assets/portfolio/<slug>/` and are copied
 * to the app's `/images/portfolio/` at build (vite-plugin-static-copy in the
 * app's astro.config), so `src` here is the eventual public URL.
 *
 * OpenCGT has no public screenshots (internal B2B), so it has no entry.
 */
const galleries: Record<string, GalleryImage[]> = {
  'hoogii-wallet': [
    {
      src: '/images/portfolio/hoogii-wallet/01.jpeg',
      alt: 'Hoogii Wallet landing page — a fully open-source Chia crypto wallet extension',
      caption: 'Landing page',
    },
    {
      src: '/images/portfolio/hoogii-wallet/02.jpeg',
      alt: 'Hoogii Wallet dashboard showing the XCH balance and asset list',
      caption: 'Dashboard — balances & assets',
    },
    {
      src: '/images/portfolio/hoogii-wallet/03.jpeg',
      alt: 'Hoogii Wallet activity tab with pending and past transactions',
      caption: 'Activity & transaction history',
    },
    {
      src: '/images/portfolio/hoogii-wallet/04.jpeg',
      alt: 'Verify Backup Phrase screen with the 12-word recovery-phrase grid',
      caption: 'Verify backup phrase',
    },
  ],
  'hashgreen-dex': [
    {
      src: '/images/portfolio/hashgreen-dex/03.jpeg',
      alt: 'Hashgreen DEX trading interface with the price chart, order book and trade history',
      caption: 'Trading — chart, order book & trade history',
    },
    {
      src: '/images/portfolio/hashgreen-dex/02.png',
      alt: 'Hashgreen DEX market selector with a searchable list of CAT/token markets',
      caption: 'Searchable CAT market list',
    },
    {
      src: '/images/portfolio/hashgreen-dex/04.jpeg',
      alt: 'Hashgreen DEX order history with market, status and date-range filters and pagination',
      caption: 'My orders — filterable & paginated',
    },
  ],
  'hashgreen-swap': [
    {
      src: '/images/portfolio/hashgreen-swap/01.jpeg',
      alt: 'HashgreenSwap swap-confirm flow with the swap summary and the Hoogii wallet signature request',
      caption: 'Swap confirm & wallet signature',
    },
  ],
};

/** The product-screenshot gallery for a project slug (empty if none). */
export function getProjectGallery(slug: string): GalleryImage[] {
  return galleries[slug] ?? [];
}
