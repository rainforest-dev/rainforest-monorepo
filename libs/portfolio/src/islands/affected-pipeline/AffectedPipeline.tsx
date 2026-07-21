import { type JSX, useEffect, useState } from 'react';

import { useReducedMotion } from '../_shared/useReducedMotion';
import {
  affectedFromFiles,
  CHANGED_FILES,
  type PipelineEvent,
  PROJECTS,
  renderPipelineLog,
} from './logic';

type RunStage = 'idle' | 'running' | 'done';

const LOG_LINE_DELAY_MS = 300;

/** Real, verified in the repo — every role passes the same three checks. */
const PLAYWRIGHT_ROLES = ['hospital_admin', 'manufacturer_admin', 'root'];

/** Static VU-ramp shape (0 → 100 VUs) — the real k6 browser test asserts a 1.00 checks rate throughout. */
const K6_RAMP = [16, 28, 40, 52, 64, 76, 88, 100, 100, 100, 92, 100];

export function AffectedPipeline(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const [event, setEvent] = useState<PipelineEvent>('pr');
  const [stage, setStage] = useState<RunStage>('idle');
  const [visibleLines, setVisibleLines] = useState(0);

  const changedPaths = CHANGED_FILES.filter((f) => changed[f.path]).map(
    (f) => f.path,
  );
  const affected = affectedFromFiles(changedPaths);
  const fullLog = renderPipelineLog(affected, event);
  const log = fullLog.slice(0, visibleLines);
  const running = stage === 'running';

  // Streams the log one line at a time — reduced motion shows it all at once.
  useEffect(() => {
    if (stage !== 'running') return undefined;
    if (reducedMotion) {
      setVisibleLines(fullLog.length);
      setStage('done');
      return undefined;
    }
    if (visibleLines >= fullLog.length) {
      setStage('done');
      return undefined;
    }
    const t = setTimeout(
      () => setVisibleLines((prev) => prev + 1),
      LOG_LINE_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [stage, visibleLines, fullLog.length, reducedMotion]);

  const toggleFile = (path: string) => {
    setChanged((prev) => ({ ...prev, [path]: !prev[path] }));
    setStage('idle');
    setVisibleLines(0);
  };

  const setEventAndReset = (next: PipelineEvent) => {
    setEvent(next);
    setStage('idle');
    setVisibleLines(0);
  };

  const runPipeline = () => {
    if (running) return;
    setVisibleLines(0);
    setStage('running');
  };

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="flex flex-wrap gap-6">
        <div className="min-w-[240px] flex-1">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
            Changed files
          </div>
          {CHANGED_FILES.map((file) => (
            <label
              key={file.path}
              className="flex items-center gap-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={!!changed[file.path]}
                onChange={() => toggleFile(file.path)}
                className="accent-primary h-3.5 w-3.5"
              />
              <span className="font-mono text-xs">{file.path}</span>
            </label>
          ))}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <div className="bg-muted inline-flex gap-1 rounded-lg p-1">
              <button
                type="button"
                aria-pressed={event === 'pr'}
                onClick={() => setEventAndReset('pr')}
                className={`h-7 rounded-md px-3 font-mono text-xs font-bold ${
                  event === 'pr'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                PR
              </button>
              <button
                type="button"
                aria-pressed={event === 'push'}
                onClick={() => setEventAndReset('push')}
                className={`h-7 rounded-md px-3 font-mono text-xs font-bold ${
                  event === 'push'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                push → main
              </button>
            </div>
            <button
              type="button"
              onClick={runPipeline}
              disabled={running}
              className="bg-primary text-primary-foreground ml-auto h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
            >
              {running ? 'running…' : 'Run pipeline'}
            </button>
          </div>
        </div>

        <div className="min-w-[280px] flex-[1.3]">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
            nx project graph
          </div>
          <div className="flex flex-wrap gap-2">
            {PROJECTS.map((project) => {
              const isAffected = affected.has(project.id);
              const lit = isAffected && running;
              return (
                <span
                  key={project.id}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs ${
                    lit
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isAffected
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {project.label}
                </span>
              );
            })}
          </div>
          <div
            role="log"
            aria-label="Pipeline output"
            className="bg-background/60 border-border mt-3.5 min-h-[8lh] rounded-lg border p-3.5 font-mono text-xs leading-relaxed"
          >
            {log.length === 0 ? (
              <div className="text-muted-foreground">
                idle — tick files, pick PR / push, run.
              </div>
            ) : (
              log.map((line, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap ${
                    line.includes('✓') ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border-border mt-5 flex flex-wrap gap-6 border-t pt-4">
        <div className="min-w-[240px] flex-1">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
            Playwright · role matrix
          </div>
          <div className="border-border overflow-hidden rounded-lg border">
            <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] px-3 py-2 text-[11px]">
              <span>role</span>
              <span>login</span>
              <span>gate</span>
              <span>flow</span>
            </div>
            {PLAYWRIGHT_ROLES.map((role) => (
              <div
                key={role}
                className="border-border grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] items-center border-t px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{role}</span>
                <span className="text-primary font-bold">✓</span>
                <span className="text-primary font-bold">✓</span>
                <span className="text-primary font-bold">✓</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
            k6 · VU ramp
          </div>
          <div className="border-border flex h-[92px] items-end gap-1 rounded-lg border p-2.5">
            {K6_RAMP.map((pct, i) => (
              <div
                key={i}
                style={{ height: `${pct}%` }}
                className="bg-primary flex-1 rounded-t-sm"
              />
            ))}
          </div>
          <div className="text-muted-foreground mt-1.5 flex justify-between text-[11px]">
            <span>0 → 100 VUs</span>
            <span className="text-primary font-bold">checks 1.00</span>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-4 font-mono text-xs">
        Mirrors nx.json · .github/workflows/ci.yml · apps/web-e2e ·
        apps/web-load
      </p>
    </div>
  );
}

export default AffectedPipeline;
