import { type JSX, useEffect, useState } from 'react';

import { avatar, button } from '../_shared/ui';
import { useReducedMotion } from '../_shared/useReducedMotion';
import { nextWalletStage, type WalletStage } from './logic';

interface WalletOption {
  id: string;
  label: string;
  mono: string;
}

const WALLETS: WalletOption[] = [
  { id: 'goby', label: 'Goby', mono: 'G' },
  { id: 'hoogii', label: 'Hoogii', mono: 'H' },
  { id: 'chia', label: 'Chia (WalletConnect)', mono: 'C' },
];

const STAGE_NODES: { stage: WalletStage; label: string }[] = [
  { stage: 'unspecified', label: 'Unspecified' },
  { stage: 'initial', label: 'Initial' },
  { stage: 'pairing', label: 'Pairing' },
  { stage: 'connected', label: 'Connected' },
];

const PAIR_DELAY_MS = 900;

/** Fabricated bech32-style address — cosmetic only, never a real key. */
const MOCK_ADDRESS = 'xch1c8d…44fa';

export function WalletStateMachine(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<WalletStage>('unspecified');
  const [wallet, setWallet] = useState<WalletOption | null>(null);

  const dispatch = (event: Parameters<typeof nextWalletStage>[1]) =>
    setStage((prev) => nextWalletStage(prev, event));

  // Pairing "succeeds" on its own after a short delay — a stand-in for the
  // real WalletConnect handshake. Reject/timeout below race it instead.
  useEffect(() => {
    if (stage !== 'pairing') return;
    const delay = reducedMotion ? 0 : PAIR_DELAY_MS;
    const timeout = setTimeout(
      () => setStage((prev) => nextWalletStage(prev, { type: 'paired' })),
      delay,
    );
    return () => clearTimeout(timeout);
  }, [stage, reducedMotion]);

  const handleSelectWallet = (option: WalletOption) => {
    setWallet(option);
    dispatch({ type: 'select-wallet' });
  };

  const handleReset = () => {
    setWallet(null);
    dispatch({ type: 'reset' });
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="flex flex-wrap gap-8">
        <div className="min-w-[220px] flex-1">
          {stage === 'unspecified' ? (
            <div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'connect' })}
                className={button()}
              >
                Connect wallet
              </button>
              <p className="text-muted-foreground mt-3 text-sm">
                Stage is <span className="font-mono">Unspecified</span> until
                the user opts in.
              </p>
            </div>
          ) : null}

          {stage === 'initial' ? (
            <div>
              <p className="text-foreground mb-2 text-sm">Choose a wallet</p>
              <div className="flex flex-col gap-2">
                {WALLETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectWallet(option)}
                    className="border-border bg-muted/30 text-foreground flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={avatar('bg-primary text-primary-foreground')}>
                      {option.mono}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {stage === 'pairing' ? (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="border-muted-foreground/30 border-t-primary h-5 w-5 shrink-0 animate-spin rounded-full border-2"
                  aria-hidden="true"
                />
                <span className="text-foreground text-sm">
                  Waiting for {wallet?.label ?? 'wallet'} to approve pairing…
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'reject' })}
                  className={button({ variant: 'danger', size: 'sm' })}
                >
                  reject pairing
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'timeout' })}
                  className={button({ variant: 'outline', size: 'sm' })}
                >
                  pairing timeout
                </button>
              </div>
            </div>
          ) : null}

          {stage === 'connected' ? (
            <div>
              <div className="border-primary/40 bg-primary/10 mb-4 flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className={avatar('bg-primary text-primary-foreground')}>
                  {wallet?.mono ?? '?'}
                </span>
                <div>
                  <div className="text-foreground text-sm font-semibold">
                    {wallet?.label ?? 'Wallet'}
                  </div>
                  <div className="text-primary font-mono text-xs">
                    {MOCK_ADDRESS}
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground mb-4 text-sm">
                The navbar and order book reshape for a connected account —
                <span className="font-mono"> shortenAddress</span> and
                <span className="font-mono"> iconUrl</span> come off one
                account object.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className={button({ variant: 'outline', size: 'sm' })}
              >
                disconnect
              </button>
            </div>
          ) : null}

          {stage === 'error' ? (
            <div>
              <p
                role="alert"
                className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border px-3 py-2 text-sm"
              >
                Pairing failed — the request was rejected or timed out.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'connect' })}
                  className={button({ size: 'sm' })}
                >
                  try again
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className={button({ variant: 'outline', size: 'sm' })}
                >
                  reset
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="text-muted-foreground mb-3 font-mono text-[11px] uppercase">
            stage machine
          </div>
          <ol className="flex flex-col">
            {STAGE_NODES.map((node, index) => (
              <li key={node.stage}>
                <div
                  className={`rounded-md border px-3 py-2 font-mono text-sm font-semibold ${
                    stage === node.stage
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {node.label}
                </div>
                {index < STAGE_NODES.length - 1 ? (
                  <div
                    className="text-muted-foreground py-1 text-center text-sm"
                    aria-hidden="true"
                  >
                    ↓
                  </div>
                ) : null}
              </li>
            ))}
            {stage === 'error' ? (
              <li>
                <div className="border-destructive bg-destructive/10 text-destructive mt-2 rounded-md border px-3 py-2 font-mono text-sm font-semibold">
                  Error
                </div>
              </li>
            ) : null}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default WalletStateMachine;
