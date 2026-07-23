import { type JSX, useEffect, useState } from 'react';

import { avatar, button } from '../../../shared/ui';
import { useReducedMotion } from '../../../shared/useReducedMotion';
import {
  INITIAL_OFFER_STATE,
  nextOfferState,
  type OfferEvent,
  type OfferState as OfferStateValue,
  type WalletBackend,
} from './logic';

interface WalletOption {
  id: WalletBackend;
  label: string;
  mono: string;
}

const WALLETS: WalletOption[] = [
  { id: 'goby', label: 'Goby', mono: 'G' },
  { id: 'hoogii', label: 'Hoogii', mono: 'H' },
  { id: 'chia', label: 'Chia · WalletConnect', mono: 'C' },
];

const STATUS_STEPS: {
  status: 'valid' | 'in_mempool' | 'on_chain';
  label: string;
}[] = [
  { status: 'valid', label: 'VALID' },
  { status: 'in_mempool', label: 'IN_MEMPOOL' },
  { status: 'on_chain', label: 'ON_CHAIN' },
];

const SIGN_DELAY_MS = 900;
const MEMPOOL_DELAY_MS = 1200;
const CONFIRM_DELAY_MS = 1400;

/** Fabricated Chia offer string — cosmetic only, never a real bundle. */
const MOCK_OFFER = 'offer1qqz03wxg8n7k…mock…d4e8f9c7a2b1';
const MOCK_FINGERPRINT = '3862·1174';

function statusRank(status: OfferStateValue['status']): number {
  return { pending: 0, valid: 1, in_mempool: 2, on_chain: 3, invalid: -1 }[
    status
  ];
}

const IN_MEMPOOL_RANK = statusRank('in_mempool');

export function OfferState(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<OfferStateValue>(INITIAL_OFFER_STATE);
  const { stage, status } = state;
  const [wallet, setWallet] = useState<WalletOption | null>(null);
  const [simulateConflict, setSimulateConflict] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  const dispatch = (event: OfferEvent) =>
    setState((prev) => nextOfferState(prev, event));

  // Signing and confirmation both run on a short scripted delay, standing in
  // for BLS signing and full-node polling. Under reduced motion the state
  // still advances — just without the visible wait.
  useEffect(() => {
    const delay = (ms: number) => (reducedMotion ? 0 : ms);
    if (stage === 'signing') {
      const t = setTimeout(
        () => setState((prev) => nextOfferState(prev, { type: 'validated' })),
        delay(SIGN_DELAY_MS),
      );
      return () => clearTimeout(t);
    }
    if (stage === 'tracking' && status === 'valid') {
      const t = setTimeout(
        () => setState((prev) => nextOfferState(prev, { type: 'submitted' })),
        delay(MEMPOOL_DELAY_MS),
      );
      return () => clearTimeout(t);
    }
    if (stage === 'tracking' && status === 'in_mempool') {
      const t = setTimeout(
        () =>
          setState((prev) =>
            nextOfferState(prev, {
              type: simulateConflict ? 'conflict' : 'confirmed',
            }),
          ),
        delay(CONFIRM_DELAY_MS),
      );
      return () => clearTimeout(t);
    }
    return undefined;
  }, [stage, status, reducedMotion, simulateConflict]);

  const handleConnect = (option: WalletOption) => {
    setWallet(option);
    dispatch({ type: 'connect' });
  };

  const handleReset = () => {
    setWallet(null);
    setShowOffer(false);
    setSimulateConflict(false);
    dispatch({ type: 'reset' });
  };

  const statusLabel = `offerStatusEnum.${
    status === 'invalid'
      ? 'INVALID'
      : status === 'on_chain'
        ? 'ON_CHAIN'
        : status === 'in_mempool'
          ? 'IN_MEMPOOL'
          : status === 'valid'
            ? 'VALID'
            : 'PENDING'
  }`;

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-primary font-mono text-xs">{statusLabel}</span>
      </div>

      {stage === 'idle' ? (
        <div>
          <p className="text-foreground mb-3 text-sm">
            Connect a wallet to sign the offer.
          </p>
          <div className="flex flex-col gap-2">
            {WALLETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleConnect(option)}
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

      {stage === 'connected' ? (
        <div>
          <div className="border-primary/30 bg-primary/10 mb-3 flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-foreground text-sm font-semibold">
              {wallet?.label ?? 'Wallet'}
            </span>
            <span className="text-primary font-mono text-xs">
              fp {MOCK_FINGERPRINT}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'review' })}
              className={button({ className: 'flex-1' })}
            >
              Review swap
            </button>
            <button
              type="button"
              onClick={handleReset}
              className={button({ variant: 'outline' })}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'review' ? (
        <div>
          <p className="text-foreground mb-3 text-sm font-semibold">
            Confirm swap
          </p>
          <div className="border-border bg-muted/30 mb-3 flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Offered</span>
              <span className="text-destructive font-semibold">
                − 1,000.00 XCH
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested</span>
              <span className="text-primary font-semibold">
                + ≈ 364.29 hUSDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network fee</span>
              <span>0.000005 XCH</span>
            </div>
          </div>
          <label className="mb-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={simulateConflict}
              onChange={(e) => setSimulateConflict(e.target.checked)}
              className="accent-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-muted-foreground">
              simulate a conflicting spend (offer invalidated in mempool)
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'approve' })}
              className={button({ className: 'flex-1' })}
            >
              Approve &amp; sign
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'reject' })}
              className={button({ variant: 'danger' })}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'signing' ? (
        <div className="flex items-center gap-3 py-2">
          <span
            className="border-muted-foreground/30 border-t-primary h-5 w-5 shrink-0 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <span className="text-foreground text-sm">
            Assembling offer · signing bundle with BLS keys…
          </span>
        </div>
      ) : null}

      {stage === 'tracking' ? (
        <div>
          <div className="mb-3 flex gap-2">
            {STATUS_STEPS.map((step) => {
              const rank = statusRank(status);
              const stepRank = statusRank(step.status);
              // `conflict` only ever fires from `in_mempool` (see
              // nextOfferState in logic.ts), so an invalidated offer always
              // failed exactly at IN_MEMPOOL — VALID was genuinely reached
              // before that and stays checked, instead of every step
              // un-checking once the offer goes invalid.
              const failed =
                status === 'invalid' && stepRank === IN_MEMPOOL_RANK;
              const done =
                status === 'invalid'
                  ? stepRank < IN_MEMPOOL_RANK
                  : rank >= stepRank;
              const current =
                status !== 'invalid' && rank === stepRank - 1 && rank > 0;
              const active = done || current;
              return (
                <div
                  key={step.status}
                  className={`flex-1 rounded-md border px-2 py-2 text-center ${
                    failed
                      ? 'border-destructive/40 bg-destructive/10'
                      : active
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border'
                  }`}
                >
                  <div
                    className={`text-base ${
                      failed
                        ? 'text-destructive'
                        : active
                          ? 'text-primary'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {done ? '✓' : failed ? '✗' : current ? '●' : '—'}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10px]">
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

          {status === 'on_chain' ? (
            <p
              role="status"
              className="border-primary/40 bg-primary/10 text-primary mb-3 rounded-lg border px-3 py-2 text-sm"
            >
              Settled on-chain · swap complete.
            </p>
          ) : null}
          {status === 'invalid' ? (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2 text-sm"
            >
              Offer invalidated — a coin it spent was used elsewhere first. No
              funds moved.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowOffer((prev) => !prev)}
            className="text-primary rounded font-mono text-xs transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showOffer ? '▾ hide offer' : '▸ view offer'}
          </button>
          {showOffer ? (
            <div className="border-border bg-muted/40 mb-3 mt-2 break-all rounded-md border p-2 font-mono text-xs">
              {MOCK_OFFER}
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={handleReset}
              className={button({ variant: 'outline', size: 'sm' })}
            >
              New swap
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OfferState;
