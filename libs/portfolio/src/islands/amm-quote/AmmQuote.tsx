import { type JSX, useState } from 'react';

import { cx, segment } from '../_shared/ui';
import { applySlippage, calcUserSwap, type SwapPool } from './logic';

/** Fabricated pool reserves — cosmetic only, mirrors the mock pool used in the review demo. */
const POOL: SwapPool = { reserveA: 82000, reserveB: 31160 };
const ASSET_A = 'XCH';
const ASSET_B = 'hUSDC';
const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0];

type Mode = 'in' | 'out';

function fmt(n: number, dp = 4): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function AmmQuote(): JSX.Element {
  const [mode, setMode] = useState<Mode>('in');
  const [amount, setAmount] = useState('1000');
  const [slippage, setSlippage] = useState(0.5);
  const [showMath, setShowMath] = useState(false);

  const exactIn = mode === 'in';
  const parsed = parseFloat(amount) || 0;
  const quote = calcUserSwap(POOL, parsed, exactIn);
  const bounds = applySlippage(quote, slippage);

  const payStr = exactIn ? amount : parsed > 0 ? fmt(quote.pay) : '';
  const recvStr = exactIn ? (parsed > 0 ? fmt(quote.receive) : '') : amount;

  const handlePayChange = (value: string) => {
    setMode('in');
    setAmount(value.replace(/[^0-9.]/g, ''));
  };
  const handleRecvChange = (value: string) => {
    setMode('out');
    setAmount(value.replace(/[^0-9.]/g, ''));
  };

  const impactPct = quote.priceImpact * 100;
  // Only primary/destructive exist as semantic tokens here, so price impact
  // is two-tone: destructive past 5%, primary otherwise (matches the
  // ask/bid two-tone `order-book` already uses for directional color).
  const impactClass = impactPct >= 5 ? 'text-destructive' : 'text-primary';

  const invariant = exactIn
    ? 'out = rB·x(1−φ) / (rA + x(1−φ)) · (1−ε)'
    : 'x = rA·out / ((rB − out)(1−φ)) · 1/(1−ε)';

  return (
    <div className="border-border bg-card text-card-foreground max-w-md rounded-xl border p-6">
      <div className="bg-muted/40 mb-4 inline-flex gap-1 rounded-lg p-1">
        <button
          type="button"
          aria-pressed={exactIn}
          onClick={() => setMode('in')}
          className={segment(exactIn, 'h-8 px-3 text-xs font-semibold')}
        >
          Exact in
        </button>
        <button
          type="button"
          aria-pressed={!exactIn}
          onClick={() => setMode('out')}
          className={segment(!exactIn, 'h-8 px-3 text-xs font-semibold')}
        >
          Exact out
        </button>
      </div>

      <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground mb-1 block text-xs">
            You pay
          </span>
          <input
            value={payStr}
            onChange={(e) => handlePayChange(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            spellCheck={false}
            aria-label="You pay, in XCH"
            className="text-foreground w-full bg-transparent text-2xl font-semibold outline-none"
          />
        </span>
        <span className="bg-primary/10 border-primary/30 flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold">
          {ASSET_A}
        </span>
      </label>

      <div
        className="text-muted-foreground my-1 flex justify-center"
        aria-hidden="true"
      >
        ↓
      </div>

      <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground mb-1 block text-xs">
            You receive
          </span>
          <input
            value={recvStr}
            onChange={(e) => handleRecvChange(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            spellCheck={false}
            aria-label="You receive, in hUSDC"
            className="text-foreground w-full bg-transparent text-2xl font-semibold outline-none"
          />
        </span>
        <span className="border-border bg-muted/50 flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold">
          {ASSET_B}
        </span>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-muted-foreground text-xs">slippage</span>
        {SLIPPAGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={slippage === option}
            onClick={() => setSlippage(option)}
            className={cx(
              'h-7 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              slippage === option
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {option.toFixed(1)}%
          </button>
        ))}
      </div>

      <dl className="border-border mt-4 flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Rate</dt>
          <dd>
            1 {ASSET_A} ≈ {fmt(quote.spot)} {ASSET_B}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            {exactIn ? 'Minimum received' : 'Maximum sold'}
          </dt>
          <dd>
            {exactIn
              ? `${fmt(bounds.minimumReceived)} ${ASSET_B}`
              : `${fmt(bounds.maximumSold)} ${ASSET_A}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Price impact</dt>
          <dd className={impactClass}>{impactPct.toFixed(2)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Liquidity fee (300 bps)</dt>
          <dd>{fmt(quote.fee)} XCH</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setShowMath((prev) => !prev)}
        className="text-primary mt-3 rounded font-mono text-xs transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {showMath ? '▾ hide the math' : '▸ show the math'}
      </button>
      {showMath ? (
        <div
          role="status"
          className="border-border bg-muted/40 mt-2 rounded-lg border p-3 font-mono text-xs leading-relaxed"
        >
          <div className="text-primary">{invariant}</div>
          <div className="text-muted-foreground mt-1">
            rA {fmt(POOL.reserveA, 0)} XCH · rB {fmt(POOL.reserveB, 0)} hUSDC ·
            φ 0.03 (300 bps) · ε 1e-5
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AmmQuote;
