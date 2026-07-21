import { type JSX, useState } from 'react';

import { distributePaste, isValidWord } from './logic';

const CELL_COUNT = 12;

/**
 * Small mock BIP39 subset — cosmetic only. Real membership checks in the
 * Hoogii wallet run against `wordlist_en.json` (2048 words); this island
 * never loads the full list, it just needs enough real words to demo
 * valid/invalid states convincingly.
 */
const MOCK_WORDLIST = new Set([
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
  'account',
  'accuse',
  'achieve',
  'acid',
  'acoustic',
  'acquire',
  'across',
  'act',
  'action',
  'actor',
  'actress',
  'actual',
]);

/**
 * Demo phrase used by the "paste a phrase" button — an explicit literal so
 * it stays stable regardless of edits to MOCK_WORDLIST.
 */
const DEMO_PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

export function PhraseGrid(): JSX.Element {
  const [cells, setCells] = useState<string[]>(() =>
    Array(CELL_COUNT).fill(''),
  );

  const handleChange = (index: number, value: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = value.trim().toLowerCase();
      return next;
    });
  };

  const handlePaste = () => {
    setCells(distributePaste(DEMO_PHRASE, CELL_COUNT));
  };

  const validCount = cells.filter(
    (cell) => isValidWord(cell, MOCK_WORDLIST) && cell.length > 0,
  ).length;

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <span className="text-muted-foreground text-sm">
          Recovery phrase · 12 words
        </span>
        <button
          type="button"
          onClick={handlePaste}
          className="border-primary/50 text-foreground hover:bg-primary/10 h-8 rounded-md border bg-transparent px-3 text-sm font-semibold"
        >
          paste a phrase
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {cells.map((cell, index) => {
          const invalid = !isValidWord(cell, MOCK_WORDLIST);
          return (
            <label
              key={index}
              className={`bg-muted/40 flex h-11 items-center gap-2 rounded-lg border px-3 ${
                invalid
                  ? 'border-destructive ring-destructive ring-1'
                  : 'border-border'
              }`}
            >
              <span className="text-primary min-w-4 font-mono text-xs">
                {index + 1}
              </span>
              <input
                type="text"
                value={cell}
                onChange={(event) => handleChange(index, event.target.value)}
                aria-label={`Word ${index + 1}`}
                aria-invalid={invalid}
                spellCheck={false}
                autoComplete="off"
                className="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {invalid ? (
                <span className="text-destructive text-sm" aria-hidden="true">
                  !
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={validCount}
          aria-valuemin={0}
          aria-valuemax={CELL_COUNT}
          className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full"
            style={{ width: `${(validCount / CELL_COUNT) * 100}%` }}
          />
        </div>
        <span className="text-muted-foreground font-mono text-xs">
          {validCount}/{CELL_COUNT}
        </span>
      </div>
    </div>
  );
}

export default PhraseGrid;
