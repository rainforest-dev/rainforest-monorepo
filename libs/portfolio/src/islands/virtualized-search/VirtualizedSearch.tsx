import { type JSX, useMemo, useState } from 'react';

import { computeWindow, type Market, rankMarkets } from './logic';

const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 216; // 6 rows tall
const OVERSCAN = 2;

/**
 * Fabricated CAT-market list — cosmetic only. Real markets stream from
 * `MarketStore`; this island never fetches a live registry, it just needs
 * enough rows to make windowing visible (mount count staying flat while
 * scrolling).
 */
const TICKERS = [
  'HGN',
  'XCH',
  'SBX',
  'CGT',
  'USDS',
  'WOLF',
  'DBX',
  'MRMT',
  'GOAT',
  'TIBET',
  'WUSDC',
  'HOA',
  'CATC',
  'PENG',
  'ZED',
  'PYKE',
  'NOVA',
  'ECHO',
];
const VARIANTS = ['', '2', '3', 'X', 'PRO', 'LP'];
const MOCK_MARKETS: Market[] = TICKERS.flatMap((ticker) =>
  VARIANTS.map((variant) => ({
    code: `${ticker}${variant}`,
    name: `${ticker}${variant} / USDC`,
  })),
);

export function VirtualizedSearch(): JSX.Element {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  const ranked = useMemo(() => rankMarkets(query, MOCK_MARKETS), [query]);
  const win = useMemo(
    () =>
      computeWindow(scrollTop, ROW_HEIGHT, VIEWPORT_HEIGHT, ranked.length, OVERSCAN),
    [scrollTop, ranked.length],
  );
  const mountedRows = ranked.slice(win.start, win.end);

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <label className="border-border bg-muted/40 mb-3 flex h-11 items-center gap-2 rounded-lg border px-3">
        <span className="text-primary text-sm" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setScrollTop(0);
          }}
          placeholder={`search ${MOCK_MARKETS.length} markets`}
          aria-label="Search markets"
          spellCheck={false}
          autoComplete="off"
          className="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-primary bg-primary/10 border-primary/30 rounded-md border px-2 py-1 font-mono text-xs whitespace-nowrap">
          {mountedRows.length} / {ranked.length} rows mounted
        </span>
      </label>

      <div
        role="list"
        aria-label="Markets"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        style={{ height: VIEWPORT_HEIGHT }}
        className="border-border overflow-y-auto rounded-lg border"
      >
        <div style={{ height: win.topPad }} aria-hidden="true" />
        {mountedRows.map((market) => (
          <div
            key={market.code}
            role="listitem"
            style={{ height: ROW_HEIGHT }}
            className="border-border/60 flex items-center justify-between gap-3 border-b px-3 text-sm"
          >
            <span className="text-foreground font-mono font-semibold">
              {market.code}
            </span>
            <span className="text-muted-foreground truncate">{market.name}</span>
          </div>
        ))}
        <div style={{ height: win.bottomPad }} aria-hidden="true" />
        {ranked.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            No markets match &ldquo;{query}&rdquo;.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default VirtualizedSearch;
