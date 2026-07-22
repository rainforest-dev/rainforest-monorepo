import { type JSX, useState } from 'react';

import { button } from '../_shared/ui';
import { evaluateRelay, type RelayOutcome } from './logic';

interface LogEntry {
  id: number;
  outcome: RelayOutcome;
}

const GATES: { key: RelayOutcome; label: string }[] = [
  { key: 'IS_VALID_WALLET', label: 'IS_VALID_WALLET' },
  { key: 'IS_LOCK', label: 'IS_LOCK' },
  { key: 'IS_CONNECTED', label: 'IS_CONNECTED' },
];

export function RelayGate(): JSX.Element {
  const [isValidWallet, setIsValidWallet] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const outcome = evaluateRelay({ isValidWallet, isLocked, isConnected });

  const handleRequest = () => {
    setLog((prev) => [{ id: Date.now(), outcome }, ...prev].slice(0, 5));
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isValidWallet}
            onChange={(event) => setIsValidWallet(event.target.checked)}
            className="accent-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          valid wallet
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(event) => setIsLocked(event.target.checked)}
            className="accent-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          locked
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isConnected}
            onChange={(event) => setIsConnected(event.target.checked)}
            className="accent-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          connected
        </label>
      </div>

      <ol className="mb-5 flex flex-wrap items-center gap-2 font-mono text-xs">
        {GATES.map((gate, index) => (
          <li key={gate.key} className="flex items-center gap-2">
            <span
              className={`rounded-md border px-2 py-1 ${
                outcome === gate.key
                  ? 'border-destructive text-destructive bg-destructive/10'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {gate.label}
            </span>
            {index < GATES.length - 1 ? (
              <span className="text-muted-foreground" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={handleRequest}
        className={button({ className: 'mb-4' })}
      >
        dApp requests signing
      </button>

      <div
        role="status"
        className={`mb-4 rounded-md border px-3 py-2 text-sm font-semibold ${
          outcome === 'pass'
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-destructive/40 bg-destructive/10 text-destructive'
        }`}
      >
        {outcome === 'pass'
          ? 'pass — request forwarded to signCoinSpends'
          : `blocked at ${outcome}`}
      </div>

      <ul aria-label="Relay log" className="flex flex-col gap-1">
        {log.map((entry) => (
          <li
            key={entry.id}
            className="text-muted-foreground font-mono text-xs"
          >
            [background] {entry.outcome === 'pass' ? 'forwarded' : 'rejected'}{' '}
            — {entry.outcome}
          </li>
        ))}
        {log.length === 0 ? (
          <li className="text-muted-foreground font-mono text-xs">
            idle — trigger a signing request to trace it.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default RelayGate;
