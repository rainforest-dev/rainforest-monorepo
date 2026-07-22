import { type JSX, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import { cx } from '../_shared/ui';
import {
  computeWindow,
  filterByTab,
  type Market,
  rankMarkets,
  readFavorites,
  type Tab,
  toggleFavorite,
  writeFavorites,
} from './logic';

const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 216; // 6 rows tall
const OVERSCAN = 2;

/**
 * Fabricated CAT-market list — cosmetic only, but sized (32 tickers × 16
 * variants = 512) to match the real list's scale. Real markets stream from
 * `MarketStore`; this island never fetches a live registry, it just needs
 * enough rows to make windowing visible (mount count staying flat while
 * scrolling 500-plus rows).
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
  'ORCA',
  'LOTUS',
  'EMBER',
  'CORAL',
  'DUSK',
  'FROST',
  'GLOW',
  'HAZE',
  'IVORY',
  'JADE',
  'KOI',
  'LUNA',
  'MIST',
  'NEON',
];
const VARIANTS = [
  '',
  '2',
  '3',
  'X',
  'PRO',
  'LP',
  'MINI',
  'MAX',
  'ALPHA',
  'BETA',
  'GAMMA',
  'DELTA',
  'ZETA',
  'OMEGA',
  'PRIME',
  'CORE',
];
const MOCK_MARKETS: Market[] = TICKERS.flatMap((ticker) =>
  VARIANTS.map((variant) => ({
    code: `${ticker}${variant}`,
    name: `${ticker}${variant} / USDC`,
  })),
);

const TABS: { id: Tab; label: (favCount: number) => string }[] = [
  { id: 'all', label: () => 'All' },
  { id: 'favorites', label: (count) => `Favorites (${count})` },
];

function localStorageOrUndefined(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function VirtualizedSearch(): JSX.Element {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    readFavorites(localStorageOrUndefined()),
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    writeFavorites(localStorageOrUndefined(), favorites);
  }, [favorites]);

  const tabMarkets = useMemo(
    () => filterByTab(MOCK_MARKETS, tab, favorites),
    [tab, favorites],
  );
  const ranked = useMemo(() => rankMarkets(query, tabMarkets), [query, tabMarkets]);
  const win = useMemo(
    () =>
      computeWindow(scrollTop, ROW_HEIGHT, VIEWPORT_HEIGHT, ranked.length, OVERSCAN),
    [scrollTop, ranked.length],
  );
  const mountedRows = ranked.slice(win.start, win.end);
  const hasQuery = query.trim().length > 0;

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length;
    setTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const toggleStar = (code: string) => {
    setFavorites((prev) => toggleFavorite(prev, code));
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div role="tablist" aria-label="Market list tabs" className="mb-3 flex gap-2">
        {TABS.map((tabDef, index) => {
          const selected = tab === tabDef.id;
          return (
            <button
              key={tabDef.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`vs-tab-${tabDef.id}`}
              aria-selected={selected}
              aria-controls="vs-tabpanel"
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setTab(tabDef.id);
                setScrollTop(0);
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cx(
                'h-8 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              {tabDef.label(favorites.size)}
            </button>
          );
        })}
      </div>

      <div
        id="vs-tabpanel"
        role="tabpanel"
        aria-labelledby={`vs-tab-${tab}`}
      >
        <label className="border-border bg-muted/40 mb-3 flex h-11 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
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
            className="text-foreground min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
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
          {mountedRows.map((market) => {
            const isFavorite = favorites.has(market.code);
            return (
              <div
                key={market.code}
                role="listitem"
                style={{ height: ROW_HEIGHT }}
                className="border-border/60 flex items-center gap-3 border-b px-3 text-sm"
              >
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  aria-label={
                    isFavorite
                      ? `Remove ${market.code} from favorites`
                      : `Add ${market.code} to favorites`
                  }
                  onClick={() => toggleStar(market.code)}
                  className={cx(
                    'shrink-0 rounded text-base leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isFavorite ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
                </button>
                <span className="text-foreground shrink-0 font-mono font-semibold">
                  {market.code}
                </span>
                <span className="text-muted-foreground flex-1 truncate">
                  {market.name}
                </span>
                {hasQuery ? (
                  <span className="text-primary shrink-0 font-mono text-[11px]">
                    score {market.score.toFixed(2)}
                  </span>
                ) : null}
              </div>
            );
          })}
          <div style={{ height: win.bottomPad }} aria-hidden="true" />
          {ranked.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {tab === 'favorites'
                ? 'No favorites yet — star a market to pin it here.'
                : `No markets match “${query}”.`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedSearch;
