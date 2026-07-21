import { type JSX, useEffect, useState } from 'react';

import { useReducedMotion } from '../_shared/useReducedMotion';
import { nextLockState } from './logic';

const TICK_MS = 200;
const MIN_THRESHOLD_MS = 2000;
const MAX_THRESHOLD_MS = 10000;
const DEFAULT_THRESHOLD_MS = 5000;

export function IdleLock(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [thresholdMs, setThresholdMs] = useState(DEFAULT_THRESHOLD_MS);
  const [idleMs, setIdleMs] = useState(0);

  const state = nextLockState(idleMs, thresholdMs);

  // Real Hoogii resets the countdown on `onMouseMove`/`onKeyDown` via
  // chrome.idle.setDetectionInterval, not a page-visible timer. This
  // interval is a cosmetic stand-in for that idle signal ticking up.
  useEffect(() => {
    if (reducedMotion || state === 'locked') return;
    const interval = setInterval(() => {
      setIdleMs((prev) => Math.min(prev + TICK_MS, thresholdMs));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [reducedMotion, state, thresholdMs]);

  const resetActivity = () => setIdleMs(0);
  const lockNow = () => setIdleMs(thresholdMs);

  const idleRatio = Math.min(idleMs / thresholdMs, 1);

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <span className="text-muted-foreground text-sm">
          Wallet session · idle auto-lock
        </span>
        <span
          role="status"
          className={`rounded-full px-3 py-1 font-mono text-xs ${
            state === 'locked'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {state}
        </span>
      </div>

      <label className="text-muted-foreground mb-2 flex items-center justify-between text-xs">
        <span>idle threshold</span>
        <span className="text-primary font-mono">
          {(thresholdMs / 1000).toFixed(1)}s
        </span>
      </label>
      <input
        type="range"
        min={MIN_THRESHOLD_MS}
        max={MAX_THRESHOLD_MS}
        step={500}
        value={thresholdMs}
        onChange={(event) => {
          setThresholdMs(Number(event.target.value));
          setIdleMs(0);
        }}
        aria-label="Idle threshold in milliseconds"
        className="accent-primary mb-5 w-full"
      />

      <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
        <span>idle · auto-locks when the bar fills</span>
        <span className="font-mono">
          {(idleMs / 1000).toFixed(1)}s / {(thresholdMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={idleMs}
        aria-valuemin={0}
        aria-valuemax={thresholdMs}
        className="bg-muted mb-5 h-2 overflow-hidden rounded-full"
      >
        <div
          className={`h-full ${state === 'locked' ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${idleRatio * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={resetActivity}
          className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-semibold"
        >
          reset activity
        </button>
        <button
          type="button"
          onClick={lockNow}
          disabled={state === 'locked'}
          className="border-primary/50 text-foreground hover:bg-primary/10 h-9 rounded-md border bg-transparent px-4 text-sm font-semibold disabled:opacity-40"
        >
          lock now
        </button>
      </div>
    </div>
  );
}

export default IdleLock;
