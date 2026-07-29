import { type JSX, useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../../../shared/useReducedMotion';
import { applyTransaction } from './logic';

interface Activity {
  id: number;
  title: string;
  sub: string;
  amount: string;
  direction: 'in' | 'out';
}

const CAP = 6;
const TICK_MS = 2000;

const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: -1,
    title: 'Received',
    sub: 'from xch1c8d…44fa',
    amount: '+2.0 XCH',
    direction: 'in',
  },
  {
    id: -2,
    title: 'Sent',
    sub: 'to xch1a91…09be',
    amount: '-0.75 XCH',
    direction: 'out',
  },
  {
    id: -3,
    title: 'Received',
    sub: 'from xch1f30…7c2d',
    amount: '+5.0 XCH',
    direction: 'in',
  },
];

/**
 * Mock incoming-transaction pool — cosmetic only. Real transactions arrive
 * via an Ably channel named `'0x' + puzzleHash`; this island fakes the
 * arrival with a timer instead of a socket.
 */
const MOCK_POOL: Omit<Activity, 'id'>[] = [
  {
    title: 'Received',
    sub: 'from xch1b7e…21ac',
    amount: '+1.25 XCH',
    direction: 'in',
  },
  {
    title: 'Sent',
    sub: 'to xch1de4…88f0',
    amount: '-0.4 XCH',
    direction: 'out',
  },
  {
    title: 'Received',
    sub: 'from xch1990…5b6c',
    amount: '+3.1 XCH',
    direction: 'in',
  },
];

export function LiveLedger(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const counterRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;

    const interval = setInterval(() => {
      counterRef.current += 1;
      const template = MOCK_POOL[counterRef.current % MOCK_POOL.length];
      const tx: Activity = { id: counterRef.current, ...template };
      setActivities((prev) => applyTransaction(prev, tx, CAP));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-foreground text-2xl font-bold">
            12.5 <span className="text-muted-foreground text-sm">XCH</span>
          </div>
          <div className="text-muted-foreground font-mono text-xs">
            channel 0x1a2b…9f3e
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${reducedMotion ? 'bg-muted-foreground' : 'bg-primary'}`}
            aria-hidden="true"
          />
          {reducedMotion ? 'static (reduced motion)' : 'live'}
        </div>
      </div>

      <ul aria-label="Transaction ledger" className="flex flex-col gap-2">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                activity.direction === 'in'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
              aria-hidden="true"
            >
              •
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-foreground text-sm font-semibold">
                {activity.title}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {activity.sub}
              </div>
            </div>
            <span
              className={`text-sm font-semibold ${
                activity.direction === 'in'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {activity.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LiveLedger;
