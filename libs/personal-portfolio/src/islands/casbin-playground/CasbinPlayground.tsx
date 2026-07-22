import { type JSX, useEffect, useState } from 'react';

import { button } from '../_shared/ui';
import { useReducedMotion } from '../_shared/useReducedMotion';
import { DEFAULT_POLICIES, enforce, type PolicyRow } from './logic';

const SUBJECTS = ['root', 'hospital_admin', 'manufacturer_admin', 'alice'];
const OBJECTS = [
  '/patients/123',
  '/patients',
  '/materials/9',
  '/shipments/1',
  '/users',
];
const ACTIONS = ['read', 'write', 'delete'];
const EDITABLE_ACTIONS = ['read', 'write', 'delete', '*'];

const PHASE_DELAY_MS = 260;
const MAX_PHASE = 4;

export function CasbinPlayground(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [sub, setSub] = useState('hospital_admin');
  const [obj, setObj] = useState('/patients/123');
  const [act, setAct] = useState('read');
  const [policies, setPolicies] = useState<PolicyRow[]>(DEFAULT_POLICIES);
  const [phase, setPhase] = useState(-1);

  // Steps the matcher left→right: g, then keyMatch, then act, then verdict —
  // reduced motion jumps straight to the full reveal.
  useEffect(() => {
    if (phase < 0 || phase >= MAX_PHASE) return undefined;
    if (reducedMotion) {
      setPhase(MAX_PHASE);
      return undefined;
    }
    const t = setTimeout(() => setPhase((prev) => prev + 1), PHASE_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  const rows = enforce({ sub, obj, act }, policies);
  const allowed = rows.some((row) => row.match);
  const showVerdict = phase >= MAX_PHASE;

  const resetPhase = () => setPhase(-1);

  const handleEnforce = () => setPhase(0);

  const handleActEdit = (index: number, value: string) => {
    setPolicies((prev) =>
      prev.map((row, i) => (i === index ? { ...row, act: value } : row)),
    );
    resetPhase();
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground mb-1.5 block text-xs">
            r.sub
          </span>
          <select
            value={sub}
            onChange={(e) => {
              setSub(e.target.value);
              resetPhase();
            }}
            className="border-border bg-background text-foreground h-9 min-w-52 rounded-md border pl-2 pr-8 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {SUBJECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1.5 block text-xs">
            r.obj
          </span>
          <select
            value={obj}
            onChange={(e) => {
              setObj(e.target.value);
              resetPhase();
            }}
            className="border-border bg-background text-foreground h-9 min-w-40 rounded-md border pl-2 pr-8 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {OBJECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1.5 block text-xs">
            r.act
          </span>
          <select
            value={act}
            onChange={(e) => {
              setAct(e.target.value);
              resetPhase();
            }}
            className="border-border bg-background text-foreground h-9 min-w-28 rounded-md border pl-2 pr-8 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {ACTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleEnforce}
          className={button({ size: 'sm' })}
        >
          Enforce
        </button>
      </div>

      <div className="border-border mt-4 overflow-hidden rounded-lg border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.3fr_1.3fr_1fr_1.8fr] px-3 py-2 text-[11px] tracking-wide uppercase">
          <span>p.sub</span>
          <span>p.obj</span>
          <span>p.act</span>
          <span>matcher</span>
        </div>
        {rows.map((row, i) => (
          <div
            key={`${row.policy.sub}-${row.policy.obj}-${i}`}
            className={`border-border grid grid-cols-[1.3fr_1.3fr_1fr_1.8fr] items-center border-t px-3 py-2 ${
              phase >= MAX_PHASE && row.match ? 'bg-primary/5' : ''
            }`}
          >
            <span className="font-mono text-xs">{row.policy.sub}</span>
            <span className="font-mono text-xs">{row.policy.obj}</span>
            <span>
              {row.policy.fixed ? (
                <span className="font-mono text-xs">{row.policy.act}</span>
              ) : (
                <select
                  aria-label={`policy action for ${row.policy.sub} ${row.policy.obj}`}
                  value={row.policy.act}
                  onChange={(e) => handleActEdit(i, e.target.value)}
                  className="border-border bg-background h-7 min-w-24 rounded-md border pl-1.5 pr-7 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EDITABLE_ACTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {phase >= 1 ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    row.g
                      ? 'bg-primary/10 text-primary'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  g {row.g ? '✓' : '✕'}
                </span>
              ) : null}
              {phase >= 2 ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    row.keyMatch
                      ? 'bg-primary/10 text-primary'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  key {row.keyMatch ? '✓' : '✕'}
                </span>
              ) : null}
              {phase >= 3 ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    row.actMatch
                      ? 'bg-primary/10 text-primary'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  act {row.actMatch ? '✓' : '✕'}
                </span>
              ) : null}
              {phase >= MAX_PHASE ? (
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                    row.match ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {row.match ? 'MATCH' : '—'}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {showVerdict ? (
        <div
          role="status"
          className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-4 ${
            allowed
              ? 'border-primary/40 bg-primary/10'
              : 'border-destructive/40 bg-destructive/10'
          }`}
        >
          <span
            className={`text-lg font-extrabold tracking-wide ${
              allowed ? 'text-primary' : 'text-destructive'
            }`}
          >
            {allowed ? 'ALLOW' : 'DENY'}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            enforce(&quot;{sub}&quot;, &quot;{obj}&quot;, &quot;{act}&quot;)
          </span>
        </div>
      ) : null}
      <p className="text-muted-foreground mt-4 font-mono text-xs">
        Mirrors lib/casbin/model.conf · lib/casbin/policy.csv · enforcer.ts
      </p>
    </div>
  );
}

export default CasbinPlayground;
