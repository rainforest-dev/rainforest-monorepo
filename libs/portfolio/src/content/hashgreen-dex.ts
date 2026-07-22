import type { CaseStudy } from './types';

export const hashgreenDex: CaseStudy = {
  slug: 'hashgreen-dex',
  variant: 'dex',
  title: 'Hashgreen DEX',
  tagline:
    'A Next.js order-book exchange for trading Chia CAT tokens, with per-market routes and a live order book.',
  role: 'Frontend Engineer · Hashgreen Labs',
  period: '2022 – Present',
  stack: ['Next.js', 'Tailwind + daisyUI', 'Mobx', 'Ably', 'Docker'],
  sections: [
    {
      id: '500-cats-one-searchable-list',
      title: '500+ CATs, one searchable list',
      feature:
        'A tabbed, fuzzy-searchable market list that scrolls 500-plus assets while keeping only the on-screen rows mounted.',
      contribution:
        'I led the frontend and owned this list. I refused to trade rendering speed against searchability, so I layered three independent mechanisms — windowing, deferred fetch, fuzzy scoring — each solving one axis. The Fuse threshold is 0.1 on purpose: tickers are short and collision-prone.',
      tech: '`TableVirtuoso` mounts only the rows in view; `MarketStore` uses `onBecomeObserved`/`onBecomeUnobserved` so a market defers fetching until something observes it; `Fuse` with `threshold: 0.1` scores over currency code and name.',
      interaction: 'virtualized-search',
      sourceRef:
        'src/components/Markets/MarketList.tsx · src/stores/MarketStore.ts · src/utils/fuse.ts',
    },
    {
      id: 'reading-the-book-without-acting-on-a-ghost',
      title: 'Reading the book without acting on a ghost',
      feature:
        'A live bid/ask book where clicking a level opens a summary panel, and a level that moves off the book closes it instantly.',
      contribution:
        'I owned an invariant: a trader must never act on a price level that has already moved. A tooltip anchored to a row that gets replaced is a first-class event that closes the popover — not a rendering afterthought.',
      tech: "A reconciliation `useEffect` keys every level by `key(market, price, amount, total)` and clears the selection the moment that key stops matching anything in the current book — the same invariant the production UI's side-aware `react-popper` tooltip relies on to avoid anchoring to a row that no longer exists.",
      interaction: 'order-book',
      sourceRef:
        'src/components/Trade/OrderBook.tsx · src/components/Trade/OfferTooltip.tsx',
    },
    {
      id: 'fetch-once-then-stream',
      title: 'Fetch once, then stream',
      feature:
        'Stats and a trade tape that load once over REST, then go live over one subscription — with a dot that mirrors the socket.',
      contribution:
        'I built streaming as one reusable contract. Every live surface hydrates the same way — one REST fetch, then one hook — and every subscription tears down on unmount and re-subscribes cleanly when the channel changes.',
      tech: "A `useAbly({ channelName, events, callback })` hook owns the whole subscription lifecycle; `ablyIndicator` reads Ably's connection state to drive the dot.",
      interaction: 'fetch-then-stream',
      sourceRef:
        'src/hooks/useAbly.ts · src/components/Navbar/ablyIndicator.tsx',
    },
    {
      id: 'one-state-machine-three-wallets',
      title: 'One state machine, three wallets',
      feature:
        'Connect Goby, Hoogii, or Chia over WalletConnect — all resolving to one shortened address and one connected state.',
      contribution:
        'I built this around one source of truth — WalletStageEnum — instead of a scatter of booleans. WalletConnect pairing is its own explicit stage, because pairing can be rejected or time out, and those had to be first-class states, not error handling bolted on afterward.',
      tech: 'A small stage machine — `Unspecified → Initial → Pairing → Connected` — sits over per-wallet `Wallet` classes; the connected account exposes `shortenAddress` and `iconUrl`.',
      interaction: 'wallet-state-machine',
      sourceRef: 'src/stores/WalletStore.ts · src/utils/wallets/*.ts',
    },
    {
      id: 'patch-one-row-or-refetch-the-page',
      title: 'Patch one row, or refetch the page?',
      feature:
        'A live order history — paginated and filterable — that decides per event whether to refetch the page or patch one row.',
      contribution:
        "I owned the sync strategy here. The real question is whether a live update still belongs on the page you're looking at. Refetch only when an event changes page membership; otherwise patch the row in place and leave everything else untouched.",
      tech: "A page-keyed cache is fed by an Ably channel scoped to `auth.id`. Each event runs `needRefetch()` = `checkMarket && checkStatus && checkDateRange`; when it's false, `checkUserOrderCached()` swaps just that row in place.",
      interaction: 'patch-vs-refetch',
      sourceRef: 'src/stores/OrderStore.ts · src/hooks/useUserOrders.ts',
    },
  ],
  // Placeholder gallery — drop real screenshots into
  // apps/personal-website/public/images/portfolio/hashgreen-dex/ and set `src`.
  gallery: [
    { alt: 'Hashgreen DEX market page with the live order book', caption: 'Market — live order book' },
    { alt: 'Searchable 500+ CAT market list', caption: 'Market list & search' },
    { alt: 'Place-order panel with the offer summary', caption: 'Place order' },
    { alt: 'Open orders and history with per-market filters', caption: 'Orders & history' },
  ],
};
