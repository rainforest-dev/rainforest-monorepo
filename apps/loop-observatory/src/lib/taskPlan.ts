import type { MachineBudgetMap } from './budget.js';
import type { SprintTask, TaskScope } from './tasks.js';

export type AgentProvider = 'claude' | 'codex' | 'agy';
export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface ExecutionPlan {
  provider: AgentProvider;
  model: string;
  effort: AgentEffort;
  inputTokens: number;
  outputTokens: number;
  maxMinutes: number;
  quotaWindow: string;
  fallback: string | null;
  rationale: string;
}

export interface PlanCandidate extends ExecutionPlan {
  id: string;
  label: string;
  recommended: boolean;
  availability: 'fresh' | 'stale' | 'unknown';
  usedPct: number | null;
  sourceMachine: string | null;
}

export interface TaskPlanResponse {
  candidates: PlanCandidate[];
  saved: ExecutionPlan | null;
}

const PROVIDERS: {
  provider: AgentProvider;
  label: string;
  model: string;
  effort: AgentEffort;
  quotaWindow: string;
}[] = [
  {
    provider: 'claude',
    label: 'Claude',
    model: 'claude-opus-4-8',
    effort: 'high',
    quotaWindow: '5-hour + weekly',
  },
  {
    provider: 'codex',
    label: 'Codex · Sol',
    model: 'gpt-5.6-sol',
    effort: 'high',
    quotaWindow: '5-hour + weekly',
  },
  {
    provider: 'codex',
    label: 'Codex · Terra',
    model: 'gpt-5.6-terra',
    effort: 'high',
    quotaWindow: '5-hour + weekly',
  },
  {
    provider: 'agy',
    label: 'Agy',
    model: 'default',
    effort: 'medium',
    quotaWindow: 'activity estimate',
  },
];

/**
 * Which machines may execute a task of each scope.
 *
 * This is an identity boundary, not a preference. Company work runs under the
 * company seat on Air; personal work runs under the personal seat on the mini.
 * Routing a work task to the mini would execute it on a personal Max
 * subscription, which the company invariants forbid. Never widen this to "pick
 * whichever machine has quota headroom" -- an unrunnable plan is strictly safer
 * than one that runs under the wrong identity.
 */
const SCOPE_MACHINES: Record<TaskScope, readonly string[]> = {
  work: ['Angibles-MacBook-Air', 'Angibles-Air'],
  personal: ['rainforest-mini'],
};

function usageFor(
  task: SprintTask,
  provider: AgentProvider,
  budgets: MachineBudgetMap,
): {
  availability: PlanCandidate['availability'];
  usedPct: number | null;
  sourceMachine: string | null;
} {
  const allowed = SCOPE_MACHINES[task.scope];
  const rows = Object.values(budgets)
    .filter((machine) => allowed.includes(machine.machine))
    .map((machine) => {
      if (provider === 'claude') {
        const block = machine.claude;
        if (!block) return null;
        const pct =
          block.weekly_all?.used_pct ?? block.five_hour?.used_pct ?? null;
        return {
          machine: machine.machine,
          pct,
          stale: machine.stale_minutes !== null && machine.stale_minutes > 10,
        };
      }
      if (provider === 'codex') {
        const block = machine.codex;
        if (!block) return null;
        const pct = block.weekly?.used_pct ?? block.five_hour?.used_pct ?? null;
        return {
          machine: machine.machine,
          pct,
          stale: machine.stale_minutes !== null && machine.stale_minutes > 10,
        };
      }
      const block = machine.agy;
      if (!block) return null;
      return {
        machine: machine.machine,
        pct: null,
        stale: machine.stale_minutes !== null && machine.stale_minutes > 10,
      };
    })
    .filter(
      (row): row is { machine: string; pct: number | null; stale: boolean } =>
        row !== null,
    )
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));

  const row = rows[0];
  if (!row)
    return { availability: 'unknown', usedPct: null, sourceMachine: null };
  return {
    availability: row.stale ? 'stale' : 'fresh',
    usedPct: row.pct,
    sourceMachine: row.machine,
  };
}

function recommendation(
  task: SprintTask,
  provider: AgentProvider,
  model: string,
): boolean {
  const text = `${task.id} ${task.name}`.toLowerCase();
  if (task.scope === 'personal') return provider === 'agy';
  if (/abac|authorization|architecture|migration|rbac|policy/.test(text)) {
    return provider === 'codex' && model === 'gpt-5.6-sol';
  }
  if (/ci|workflow|developer experience|lint|typecheck|test/.test(text)) {
    return provider === 'codex' && model === 'gpt-5.6-terra';
  }
  return provider === 'claude';
}

/** Build comparable provider plans without pretending subscription usage is a bill. */
export function suggestTaskPlans(
  task: SprintTask,
  budgets: MachineBudgetMap,
): TaskPlanResponse {
  const points = Math.max(1, task.points ?? 2);
  const inputTokens = 40_000 + points * 15_000;
  const outputTokens = 8_000 + points * 4_000;
  const maxMinutes = 20 + points * 10;
  const candidates = PROVIDERS.map((profile) => {
    const usage = usageFor(task, profile.provider, budgets);
    const recommended = recommendation(task, profile.provider, profile.model);
    return {
      id: `${profile.provider}:${profile.model}:${profile.effort}`,
      label: profile.label,
      provider: profile.provider,
      model: profile.model,
      effort: profile.effort,
      inputTokens,
      outputTokens,
      maxMinutes,
      quotaWindow: profile.quotaWindow,
      fallback: recommended
        ? profile.provider === 'agy'
          ? null
          : 'agy/default/medium'
        : null,
      rationale: recommended
        ? 'Best fit for this task shape and the current bounded-loop policy.'
        : 'Available alternative; compare quota freshness and executor ownership before selecting.',
      recommended,
      ...usage,
    } satisfies PlanCandidate;
  });
  candidates.sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return { candidates, saved: null };
}
