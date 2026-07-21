import { type JSX, useMemo, useState } from 'react';

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
      <label className="border-border bg-muted/40 mb-3 flex h-11 items-center gap-2 rounded-lg border px-3">
        <span className="text-primary text-sm" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search assets"
          aria-label="Search assets"
          spellCheck={false}
          autoComplete="off"
          className="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setQuery(preset)}
            className="border-primary/40 bg-primary/10 text-primary h-7 rounded-full border px-3 text-xs font-medium"
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
            <span className="bg-primary/20 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
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
