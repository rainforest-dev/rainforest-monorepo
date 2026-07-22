import { type JSX, useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../_shared/useReducedMotion';
import { channelFor, lifecycleLog, pushTrade } from './logic';

interface Trade {
  id: number;
  time: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
}

const MARKET_OPTS = ['HGN-USDC', 'XCH-USDC', 'SBX-USDC'];
const CAP = 6;
const TICK_MS = 1800;
const CONNECT_DELAY_MS = 700;
const LOG_CAP = 6;
const BASE_PRICE = 1.2431;

/**
 * Fabricated "REST hydrate" trades — cosmetic only, but present on mount
 * regardless of motion preference. The real feature is fetch-once-then-
 * stream: the one-time fetch always populates the tape; only the ongoing
 * live stream (the interval below) is continuous motion, and that's the
 * part reduced-motion turns off — the content itself must stay present.
 */
const INITIAL_TRADES: Trade[] = [
  { id: -1, time: '14:02:11', side: 'buy', price: 1.2431, amount: 42.5 },
  { id: -2, time: '14:02:13', side: 'sell', price: 1.2428, amount: 18.2 },
  { id: -3, time: '14:02:16', side: 'buy', price: 1.2433, amount: 65.7 },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  });
}

export function FetchThenStream(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [market, setMarket] = useState(MARKET_OPTS[0]);
  const [live, setLive] = useState(false);
  const [connState, setConnState] = useState<'idle' | 'connecting' | 'live'>(
    'idle',
  );
  const [trades, setTrades] = useState<Trade[]>(INITIAL_TRADES);
  const [log, setLog] = useState<string[]>([]);
  const [lastPrice, setLastPrice] = useState(BASE_PRICE);
  const prevChannelRef = useRef<string | null>(null);
  const counterRef = useRef(0);

  // Subscription lifecycle: unsubscribe from the previous channel (if any)
  // before subscribing to the next one — mirrors useAbly's cleanup-then-
  // resubscribe order on channel change or unmount.
  useEffect(() => {
    const nextChannel = live ? channelFor(market) : null;
    const lines = lifecycleLog(prevChannelRef.current, nextChannel);
    if (lines.length > 0) {
      setLog((prev) => [...lines, ...prev].slice(0, LOG_CAP));
    }
    prevChannelRef.current = nextChannel;
  }, [live, market]);

  // Connection dot: idle -> connecting -> live, unless the user prefers
  // reduced motion, in which case it settles on "live" immediately.
  useEffect(() => {
    if (!live) {
      setConnState('idle');
      return;
    }
    if (reducedMotion) {
      setConnState('live');
      return;
    }
    setConnState('connecting');
    const timeout = setTimeout(() => setConnState('live'), CONNECT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [live, market, reducedMotion]);

  // Continuous trade stream: the seeded tape above is always present, but
  // new trades only keep arriving while genuinely live AND motion isn't
  // reduced — this is the one piece of *ongoing* motion, so it's the only
  // thing reduced-motion actually turns off.
  useEffect(() => {
    if (connState !== 'live' || reducedMotion) return;
    const interval = setInterval(() => {
      counterRef.current += 1;
      const side: Trade['side'] = counterRef.current % 2 === 0 ? 'buy' : 'sell';
      const drift = (Math.random() - 0.5) * 0.004;
      const price = Number((BASE_PRICE + drift).toFixed(4));
      const trade: Trade = {
        id: counterRef.current,
        time: formatTime(new Date()),
        side,
        price,
        amount: Number((10 + Math.random() * 90).toFixed(2)),
      };
      setLastPrice(price);
      setTrades((prev) => pushTrade(prev, trade, CAP));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [connState, reducedMotion]);

  const dotClass =
    connState === 'live'
      ? 'bg-primary'
      : connState === 'connecting'
        ? 'bg-primary/50'
        : 'bg-muted-foreground';

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="fts-market">
            Market
          </label>
          <select
            id="fts-market"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className="border-border bg-muted/40 text-foreground h-9 rounded-md border pl-2 pr-8 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {MARKET_OPTS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
            {connState}
          </span>
        </div>

        <label className="text-foreground flex items-center gap-2 text-sm">
          Live
          <input
            type="checkbox"
            role="switch"
            checked={live}
            onChange={(event) => setLive(event.target.checked)}
            aria-label="Toggle live subscription"
            className="accent-primary h-5 w-9 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-6">
        <div>
          <div className="text-muted-foreground font-mono text-[11px] uppercase">
            last price
          </div>
          <div className="text-foreground font-mono text-xl font-bold">
            {lastPrice.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground font-mono text-[11px] uppercase">
            24h high
          </div>
          <div className="text-foreground font-mono text-xl font-bold">1.3129</div>
        </div>
        <div>
          <div className="text-muted-foreground font-mono text-[11px] uppercase">
            24h low
          </div>
          <div className="text-foreground font-mono text-xl font-bold">1.1904</div>
        </div>
      </div>

      <ul aria-label="Trade tape" className="mb-5 flex min-h-[6.5rem] flex-col gap-1">
        {trades.map((trade) => (
          <li
            key={trade.id}
            className="text-muted-foreground grid grid-cols-3 gap-2 font-mono text-xs"
          >
            <span>{trade.time}</span>
            <span
              className={`text-right ${trade.side === 'buy' ? 'text-primary' : 'text-destructive'}`}
            >
              {trade.side} {trade.price.toFixed(4)}
            </span>
            <span className="text-right">{trade.amount.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="border-border bg-muted/30 rounded-lg border p-3">
        <div className="text-muted-foreground mb-1 font-mono text-[11px] uppercase">
          useAbly lifecycle
        </div>
        <ul aria-label="Subscription log" className="flex flex-col gap-0.5">
          {log.map((line, index) => (
            <li key={`${line}-${index}`} className="text-primary font-mono text-xs">
              {line}
            </li>
          ))}
          {log.length === 0 ? (
            <li className="text-muted-foreground font-mono text-xs">
              idle — flip Live to subscribe; switch market to see the channel
              swap.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export default FetchThenStream;
