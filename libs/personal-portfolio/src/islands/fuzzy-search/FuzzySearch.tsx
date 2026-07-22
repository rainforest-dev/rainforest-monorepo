import { type JSX, useMemo, useState } from 'react';

import { avatar } from '../_shared/ui';
import { rank } from './logic';

/**
 * Small mock CAT/token list — cosmetic only. Mirrors the shape of the
 * Hoogii asset list (code + display name); this island never fetches a
 * real token registry, it just needs enough entries to demo ranking.
 */
const MOCK_ASSETS = [
  { code: 'XCH', name: 'Chia' },
  { code: 'SBX', name: 'Spacebucks' },
  { code: 'DBX', name: 'dexie bucks' },
  { code: 'MRMT', name: 'Marmot' },
  { code: 'WOLF', name: 'Chia Wolf' },
  { code: 'USDS', name: 'Stably USD' },
  { code: 'TIBET', name: 'TibetSwap' },
  { code: 'WUSDC', name: 'Wrapped USDC' },
  { code: 'HOA', name: 'Hoge Ants' },
  { code: 'CATC', name: 'Cool Cats' },
  { code: 'GOAT', name: 'Chia Goat' },
  { code: 'PENG', name: 'Penguin' },
];

const PRESETS = ['usd', 'chia', 'wrap'];

export function FuzzySearch(): JSX.Element {
  const [query, setQuery] = useState('');

  const results = useMemo(
    () =>
      rank(
        query,
        MOCK_ASSETS.map((asset) => `${asset.code} ${asset.name}`),
      ),
    [query],
  );

  const matched = MOCK_ASSETS.filter((asset) =>
    results.includes(`${asset.code} ${asset.name}`),
  ).sort(
    (a, b) =>
      results.indexOf(`${a.code} ${a.name}`) -
      results.indexOf(`${b.code} ${b.name}`),
  );

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <label className="border-border bg-muted/40 mb-3 flex h-11 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary size-4 shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search assets"
          aria-label="Search assets"
          spellCheck={false}
          autoComplete="off"
          className="text-foreground min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setQuery(preset)}
            className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {preset}
          </button>
        ))}
      </div>

      <ul
        aria-label="Search results"
        className="flex min-h-[4rem] flex-col gap-2"
      >
        {matched.map((asset) => (
          <li
            key={asset.code}
            className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <span className={avatar('bg-primary/20 text-primary')}>
              {asset.code.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-foreground text-sm font-semibold">
                {asset.code}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {asset.name}
              </div>
            </div>
          </li>
        ))}
        {matched.length === 0 ? (
          <li className="text-muted-foreground px-1 py-3 text-sm">
            No assets within threshold.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default FuzzySearch;
