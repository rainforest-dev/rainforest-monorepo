import { type JSX, useState } from 'react';

import { cx } from '../../../shared/ui';
import { type Level, levelKey, reconcileSelection } from './logic';

const MARKET = 'HGN-USDC';
const MID_PRICE = 1.2431;
const DEPTH = 8;

interface Row extends Level {
  side: 'ask' | 'bid';
}

/**
 * Generates a fresh bid/ask ladder around a fixed mid-price — cosmetic only.
 * Real levels stream over the order-book channel; this island fakes churn
 * with the "shuffle the book" button instead of a socket.
 */
function buildBook(): { asks: Row[]; bids: Row[] } {
  const asks: Row[] = [];
  const bids: Row[] = [];
  let cumAsk = 0;
  let cumBid = 0;
  for (let i = 1; i <= DEPTH; i++) {
    const askPrice = Number(
      (MID_PRICE + i * 0.0007 + Math.random() * 0.0004).toFixed(4),
    );
    const askAmount = Number((40 + Math.random() * 300).toFixed(2));
    cumAsk += askAmount;
    asks.push({
      price: askPrice,
      amount: askAmount,
      total: Number(cumAsk.toFixed(2)),
      side: 'ask',
    });

    const bidPrice = Number(
      (MID_PRICE - i * 0.0007 - Math.random() * 0.0004).toFixed(4),
    );
    const bidAmount = Number((40 + Math.random() * 300).toFixed(2));
    cumBid += bidAmount;
    bids.push({
      price: bidPrice,
      amount: bidAmount,
      total: Number(cumBid.toFixed(2)),
      side: 'bid',
    });
  }
  return { asks: asks.reverse(), bids };
}

export function OrderBook(): JSX.Element {
  const [book, setBook] = useState(buildBook);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapseAsks, setCollapseAsks] = useState(false);
  const [note, setNote] = useState('');

  const allLevels = [...book.asks, ...book.bids];
  const selected =
    allLevels.find((level) => levelKey(MARKET, level) === selectedKey) ??
    null;

  const handleSelect = (level: Row) => {
    const key = levelKey(MARKET, level);
    setNote('');
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  const handleShuffle = () => {
    const nextBook = buildBook();
    const nextLevels = [...nextBook.asks, ...nextBook.bids];
    const reconciled = reconcileSelection(selectedKey, MARKET, nextLevels);
    setNote(
      selectedKey !== null && reconciled === null
        ? 'Level replaced — the offer you were viewing no longer exists, so it closed.'
        : '',
    );
    setBook(nextBook);
    setSelectedKey(reconciled);
  };

  const renderRow = (level: Row) => {
    const key = levelKey(MARKET, level);
    const isSelected = key === selectedKey;
    const isAsk = level.side === 'ask';
    return (
      <button
        key={key}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${isAsk ? 'Ask' : 'Bid'} ${level.price} · amount ${level.amount} · total ${level.total}`}
        onClick={() => handleSelect(level)}
        className={cx(
          'grid w-full grid-cols-3 gap-2 rounded-md px-3 py-1.5 text-left font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected ? 'bg-primary/10 ring-primary ring-1' : 'hover:bg-muted/50',
        )}
      >
        <span className={isAsk ? 'text-destructive' : 'text-primary'}>
          {level.price.toFixed(4)}
        </span>
        <span className="text-foreground text-right">{level.amount.toFixed(2)}</span>
        <span className="text-muted-foreground text-right">
          {level.total.toFixed(2)}
        </span>
      </button>
    );
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-sm">
          {MARKET}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCollapseAsks((prev) => !prev)}
            className="border-border text-foreground hover:bg-muted h-8 rounded-md border bg-transparent px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapseAsks ? 'show asks' : 'collapse asks'}
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            className="border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 h-8 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            shuffle the book
          </button>
        </div>
      </div>

      <div className="text-muted-foreground mb-1 grid grid-cols-3 gap-2 px-3 font-mono text-[11px] uppercase">
        <span>price</span>
        <span className="text-right">amount</span>
        <span className="text-right">total</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {collapseAsks ? null : book.asks.map(renderRow)}
        <div className="border-border my-1 flex items-center gap-2 border-y px-3 py-2">
          <span className="text-foreground font-mono text-sm font-semibold">
            {MID_PRICE.toFixed(4)}
          </span>
          <span className="text-muted-foreground font-mono text-xs">mid</span>
        </div>
        {book.bids.map(renderRow)}
      </div>

      {note ? (
        <p role="status" className="text-destructive mt-3 text-sm">
          {note}
        </p>
      ) : null}

      {selected ? (
        <div
          role="status"
          className="border-border bg-muted/40 mt-4 rounded-lg border p-3 text-sm"
        >
          <p className="text-muted-foreground font-mono text-xs">
            placement: {selected.side === 'ask' ? 'right' : 'left'}
          </p>
          <p className="text-foreground mt-1 font-semibold">
            {selected.side === 'ask'
              ? `Take ask · buy ${selected.amount.toFixed(2)}`
              : `Take bid · sell ${selected.amount.toFixed(2)}`}
          </p>
          <p className="text-muted-foreground mt-1">
            @ {selected.price.toFixed(4)} · total {selected.total.toFixed(2)} USDC
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default OrderBook;
