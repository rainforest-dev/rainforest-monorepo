import { type JSX, useState } from 'react';

import {
  type AssetSide,
  pairedAmount,
  type Pool,
  poolShareMath,
  splitZap,
} from './logic';

/** Fabricated pool reserves — same mock pool as the swap quote, cosmetic only. */
const POOL: Pool = { reserveA: 82000, reserveB: 31160, lpSupply: 1250000 };
const ASSET_A = 'XCH';
const ASSET_B = 'hUSDC';

function fmt(n: number, dp = 4): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function ZapLiquidity(): JSX.Element {
  const [zap, setZap] = useState(false);
  const [side, setSide] = useState<AssetSide>('a');
  const [amount, setAmount] = useState('5000');

  const parsed = parseFloat(amount) || 0;
  const paired = pairedAmount(POOL, parsed, side);
  const zapSplit = splitZap(parsed);
  const effectiveA = zap ? zapSplit.held : paired.amountA;
  const { lpMinted, poolSharePct } = poolShareMath(POOL, effectiveA);
  const ratio = POOL.reserveB / POOL.reserveA;

  const handleAChange = (value: string) => {
    setZap(false);
    setSide('a');
    setAmount(value.replace(/[^0-9.]/g, ''));
  };
  const handleBChange = (value: string) => {
    setZap(false);
    setSide('b');
    setAmount(value.replace(/[^0-9.]/g, ''));
  };
  const handleZapChange = (value: string) => {
    setAmount(value.replace(/[^0-9.]/g, ''));
  };

  const aValue =
    zap || side === 'a' ? amount : parsed > 0 ? fmt(paired.amountA) : '';
  const bValue =
    side === 'b' && !zap ? amount : parsed > 0 ? fmt(paired.amountB) : '';

  return (
    <div className="border-border bg-card text-card-foreground max-w-md rounded-xl border p-6">
      <label className="mb-4 flex cursor-pointer items-center justify-between">
        <span className="text-foreground text-sm font-semibold">
          Zap · single-sided deposit
        </span>
        <input
          type="checkbox"
          checked={zap}
          onChange={(e) => setZap(e.target.checked)}
          className="accent-primary h-5 w-9 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {zap ? (
        <div>
          <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <span className="min-w-0 flex-1">
              <input
                value={amount}
                onChange={(e) => handleZapChange(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                spellCheck={false}
                aria-label={`Deposit amount, in ${ASSET_A}`}
                className="text-foreground w-full bg-transparent text-xl font-semibold outline-none"
              />
            </span>
            <span className="bg-primary/10 border-primary/30 flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-semibold">
              {ASSET_A}
            </span>
          </label>
          <div className="border-primary/20 bg-primary/5 mt-3 rounded-xl border p-3">
            <p className="text-primary mb-2 text-xs">
              single asset in · split before mint
            </p>
            <div
              role="img"
              aria-label={`About half held as ${ASSET_A}, about half swapped to ${ASSET_B}`}
              className="border-border flex h-3.5 overflow-hidden rounded-full border"
            >
              <div
                className="bg-primary h-full transition-[width] duration-300 ease-out"
                style={{ width: '50%' }}
              />
              <div
                className="bg-muted-foreground/40 h-full transition-[width] duration-300 ease-out"
                style={{ width: '50%' }}
              />
            </div>
            <div className="text-muted-foreground mt-1.5 flex justify-between text-[11px]">
              <span>~50% held as {ASSET_A}</span>
              <span>~50% swapped → {ASSET_B}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <span className="min-w-0 flex-1">
              <input
                value={aValue}
                onChange={(e) => handleAChange(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                spellCheck={false}
                aria-label={`Deposit amount, in ${ASSET_A}`}
                className="text-foreground w-full bg-transparent text-lg font-semibold outline-none"
              />
            </span>
            <span className="bg-primary/10 border-primary/30 flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-semibold">
              {ASSET_A}
            </span>
          </label>
          <div
            className="text-muted-foreground text-center text-sm"
            aria-hidden="true"
          >
            +
          </div>
          <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <span className="min-w-0 flex-1">
              <input
                value={bValue}
                onChange={(e) => handleBChange(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                spellCheck={false}
                aria-label={`Deposit amount, in ${ASSET_B}`}
                className="text-foreground w-full bg-transparent text-lg font-semibold outline-none"
              />
            </span>
            <span className="border-border bg-muted/50 flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-semibold">
              {ASSET_B}
            </span>
          </label>
        </div>
      )}

      <dl className="border-border mt-4 flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Share of pool</dt>
          <dd className="text-primary font-semibold">
            {poolSharePct.toFixed(4)}%
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">LP received</dt>
          <dd>{fmt(lpMinted, 2)} LP</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Pool ratio</dt>
          <dd>
            1 {ASSET_A} : {fmt(ratio)} {ASSET_B}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 font-mono text-[11px] font-semibold">
          {zap ? 'add_liquidity_zap' : 'add_liquidity'}
        </span>
        <span className="text-muted-foreground text-xs">
          {zap
            ? 'One asset in — the hook swaps ~half before minting.'
            : 'Balanced — the second input is pinned to the reserve ratio.'}
        </span>
      </div>
    </div>
  );
}

export default ZapLiquidity;
