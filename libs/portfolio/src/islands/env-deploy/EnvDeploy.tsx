import { type JSX, useEffect, useState } from 'react';

import { useReducedMotion } from '../_shared/useReducedMotion';
import {
  REAL_METRICS,
  renderDeployLog,
  renderValuesYaml,
  resolveEnv,
  SWAP_ENVS,
  type SwapEnv,
} from './logic';

type DeployStage = 'idle' | 'running' | 'done';

const LOG_LINE_DELAY_MS = 450;

export function EnvDeploy(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [env, setEnv] = useState<SwapEnv>('uat');
  const [replicas, setReplicas] = useState(2);
  const [stage, setStage] = useState<DeployStage>('idle');
  const [visibleLines, setVisibleLines] = useState(0);

  const cfg = resolveEnv(env);
  const yamlLines = renderValuesYaml(env, replicas);
  const fullLog = renderDeployLog(env, replicas);
  const log = fullLog.slice(0, visibleLines);

  // Streams the deploy log one line at a time. Under reduced motion every
  // line is present immediately — the pipeline still "runs", it just
  // doesn't animate doing it.
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

  const handleSetEnv = (next: SwapEnv) => {
    setEnv(next);
    setReplicas(resolveEnv(next).minReplicas);
    setStage('idle');
    setVisibleLines(0);
  };

  const handleDeploy = () => {
    setStage('running');
    setVisibleLines(0);
  };

  const deployLabel =
    stage === 'running'
      ? 'rolling out…'
      : stage === 'done'
        ? 're-deploy'
        : `Deploy to ${env}`;

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="bg-muted/40 mb-4 inline-flex flex-wrap gap-1 rounded-lg p-1">
        {SWAP_ENVS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={env === option}
            onClick={() => handleSetEnv(option)}
            className={`h-8 rounded-md px-3 font-mono text-xs font-semibold ${
              env === option
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <pre className="border-border bg-muted/30 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
        {yamlLines.join('\n')}
      </pre>

      <div className="mt-4 flex items-center gap-3">
        <label
          htmlFor="env-deploy-replicas"
          className="text-muted-foreground min-w-[64px] text-xs"
        >
          {replicas} {replicas > 1 ? 'replicas' : 'replica'}
        </label>
        <input
          id="env-deploy-replicas"
          type="range"
          min={1}
          max={6}
          step={1}
          value={replicas}
          onChange={(e) => {
            setReplicas(parseInt(e.target.value, 10));
            setStage('idle');
            setVisibleLines(0);
          }}
          className="accent-primary flex-1"
        />
        <span className="text-primary font-mono text-xs">
          HPA {Math.max(cfg.minReplicas, replicas)}–
          {Math.max(cfg.maxReplicas, replicas)} pods · target 70% CPU
        </span>
      </div>

      <button
        type="button"
        onClick={handleDeploy}
        disabled={stage === 'running'}
        className="bg-primary text-primary-foreground mt-4 h-10 rounded-md px-5 text-sm font-semibold disabled:opacity-60"
      >
        {deployLabel}
      </button>

      <div
        role="log"
        aria-label="Deploy pipeline output"
        className="bg-background/60 border-border mt-3 min-h-[3lh] rounded-lg border p-3 font-mono text-xs leading-relaxed"
      >
        {log.length === 0 ? (
          <div className="text-muted-foreground">
            idle — pick an environment and deploy.
          </div>
        ) : (
          log.map((line, i) => (
            <div key={i} className="text-primary whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
      </div>

      {stage === 'done' ? (
        <div className="mt-3 flex items-center gap-1.5" role="status">
          <span className="text-muted-foreground text-xs">pods:</span>
          {Array.from({ length: replicas }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="bg-primary h-3 w-3 rounded-sm"
            />
          ))}
          <span className="text-primary ml-1 text-xs">Ready</span>
        </div>
      ) : null}

      <div className="border-border mt-5 flex flex-wrap gap-6 border-t pt-4">
        <div>
          <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
            TVL
          </div>
          <div className="text-foreground text-xl font-bold">
            {REAL_METRICS.tvl}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
            All-time volume
          </div>
          <div className="text-foreground text-xl font-bold">
            {REAL_METRICS.volume}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
            Transactions
          </div>
          <div className="text-foreground text-xl font-bold">
            {REAL_METRICS.transactions}
          </div>
        </div>
        <div className="text-muted-foreground basis-full font-mono text-[11px]">
          {REAL_METRICS.breakdown}
        </div>
      </div>
    </div>
  );
}

export default EnvDeploy;
