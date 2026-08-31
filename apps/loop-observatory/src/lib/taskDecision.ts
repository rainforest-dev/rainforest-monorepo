import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type OutboxState, requestState } from './greenlightOutbox.js';
import {
  readTaskDecision,
  readTaskPlan,
  type TaskDecision,
  type TaskDecisionRecord,
} from './taskNote.js';
import type { ExecutionPlan } from './taskPlan.js';
import { readTasks, type SprintTask } from './tasks.js';

export interface DecisionGuidance {
  recommendation: TaskDecision;
  title: string;
  summary: string;
  reasons: string[];
  suggestedComment: string;
  project: string | null;
  executorReady: boolean;
  deliveryMode: DeliveryMode;
  outboxState: OutboxState;
  greenlit: boolean;
  existing: TaskDecisionRecord | null;
  executionPlan: ReturnType<typeof readTaskPlan>;
}

interface GreenlightTarget {
  slug: string;
  component: string;
}

export const GREENLIGHT_TARGETS: Record<string, GreenlightTarget> = {
  'cloud-frontend': {
    slug: 'service-dashboard-frontend',
    component: 'cloud-frontend',
  },
  'cloud-backend': {
    slug: 'service-cloud-backend',
    component: 'cloud-backend',
  },
};

/**
 * Which machine actually executes each company project. A literal map, not a
 * search for whichever host happens to be reachable -- "pick the convenient
 * machine" is exactly the bug that routed company work onto the personal seat
 * in taskPlan.ts.
 */
export const REMOTE_EXECUTORS: Record<string, string> = {
  'service-dashboard-frontend': 'rainforest-air',
  'service-cloud-backend': 'rainforest-air',
};

export type DeliveryMode = 'local' | 'remote-queue' | 'none';

/**
 * Where a greenlight for `slug` is delivered.
 *
 * A slug with a declared remote executor is queued to it *unconditionally*, and
 * the ordering here is the invariant, not a preference. `executorReady` honours
 * the `LOOP_ALLOW_COMPANY_GREENLIGHT=1` escape hatch, so consulting it first
 * would let that variable re-route a company slug to 'local' — mini would then
 * write `~/.claude/loop/greenlight/<slug>.md`, a file nothing on mini reads and
 * Air never sees, and the owner would believe the task was authorised. Checking
 * REMOTE_EXECUTORS first confines the escape hatch to slugs that have no
 * declared remote executor.
 */
export function deliveryModeFor(slug: string | null): DeliveryMode {
  if (!slug) return 'none';
  if (slug in REMOTE_EXECUTORS) return 'remote-queue';
  if (executorReady(slug)) return 'local';
  return 'none';
}

/**
 * Whether a task counts as already authorised.
 *
 * On the remote path the ack is the only truth — the mini cannot read Air's
 * allowlist, so consulting a local file there would be meaningless at best and
 * a false positive at worst. `readLocal` is a thunk precisely so that path can
 * be proven never to run.
 */
export function greenlitFor(
  mode: DeliveryMode,
  outboxState: OutboxState,
  readLocal: () => boolean,
): boolean {
  if (mode === 'remote-queue') {
    return outboxState === 'applied' || outboxState === 'duplicate';
  }
  return readLocal();
}

const TERMINAL_OR_ACTIVE = new Set([
  'closed',
  'done',
  'in qa',
  'merged',
  'released',
  'pr ready',
  'in progress',
  'in progress / pr',
  'blocked',
]);

function greenlightDir(): string {
  return (
    process.env.LOOP_GREENLIGHT_DIR ??
    join(process.env.HOME ?? '', '.claude', 'loop', 'greenlight')
  );
}

/**
 * Escape a value for literal use inside a `new RegExp` source.
 *
 * One definition, because there were three hand-written copies and one of them
 * had drifted: `/[.*+?^${}()|[\\]\\]/g` parses as "a metacharacter, then a
 * backslash, then a literal `]`", which matches almost nothing, and its
 * replacement `'\\\\$&'` inserted two backslashes rather than one. That broken
 * copy sat inside `executorReady`, a security check.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function executorReady(slug: string): boolean {
  if (process.env.LOOP_ALLOW_COMPANY_GREENLIGHT === '1') return true;
  const configPath =
    process.env.LOOP_CONFIG_PATH ??
    join(process.env.HOME ?? '', '.claude', 'loop', 'config.yaml');
  try {
    const config = readFileSync(configPath, 'utf-8');
    return new RegExp(
      `^\\s*-\\s*slug:\\s*${escapeRegExp(slug)}\\s*$`,
      'm',
    ).test(config);
  } catch {
    return false;
  }
}

function greenlightPath(slug: string): string {
  return join(greenlightDir(), `${slug}.md`);
}

function greenlightText(slug: string): string {
  try {
    return readFileSync(greenlightPath(slug), 'utf-8');
  } catch {
    return '';
  }
}

function lineFor(
  task: SprintTask,
  slug: string,
  plan: ExecutionPlan | null,
): string {
  const id = String(task.id);
  const agent = plan
    ? ` · agent: ${plan.provider}/${plan.model} · effort: ${plan.effort} · cap: ${plan.maxMinutes}m`
    : '';
  return `- ${id} — ${task.name.replace(/[\r\n]+/g, ' ')} · repo: ${slug}${agent}`;
}

function hasGreenlight(task: SprintTask, slug: string): boolean {
  const id = escapeRegExp(String(task.id));
  return new RegExp(`^\\s*-\\s*${id}(?:\\s|—|$)`, 'm').test(
    greenlightText(slug),
  );
}

function projectFor(task: SprintTask): GreenlightTarget | null {
  if (task.scope !== 'work' || !/^(?:[A-Za-z]+-)?\d+$/.test(String(task.id)))
    return null;
  return task.component ? (GREENLIGHT_TARGETS[task.component] ?? null) : null;
}

function taskFor(id: string): SprintTask | null {
  return readTasks()?.tasks.find((task) => String(task.id) === id) ?? null;
}

function normalizedStatus(task: SprintTask): string {
  return String(task.loopStatus ?? task.status)
    .trim()
    .toLowerCase();
}

function readiness(
  task: SprintTask,
  project: GreenlightTarget | null,
): {
  recommendation: TaskDecision;
  reasons: string[];
  executorReady: boolean;
} {
  const reasons: string[] = [];
  const mode = deliveryModeFor(project?.slug ?? null);
  const ready = mode !== 'none';
  if (task.scope === 'personal') {
    reasons.push(
      'Personal work follows the mini’s autonomous queue; greenlight is reserved for company allowlists.',
    );
  }
  if (!project && task.scope === 'work') {
    reasons.push(
      'No enrolled company project can be resolved from this task’s component.',
    );
  }
  if (project && mode === 'remote-queue') {
    reasons.push(
      `This host cannot execute ${project.slug}; greenlighting queues the authorisation to ${REMOTE_EXECUTORS[project.slug]}, which applies it on its next pull (up to ~5 minutes).`,
    );
  }
  if (project && mode === 'none') {
    reasons.push(
      `No executor is configured for ${project.slug} on this host or any known remote.`,
    );
  }
  if (TERMINAL_OR_ACTIVE.has(normalizedStatus(task))) {
    reasons.push(
      `The current loop/board state is “${task.loopStatus ?? task.status}”, so it is not a fresh execution candidate.`,
    );
  }
  if (task.points == null || task.points <= 0) {
    reasons.push(
      'Story points are missing or zero; estimate the work before starting execution.',
    );
  }
  if (task.priority == null) {
    reasons.push(
      'Priority is not set; confirm sprint ordering before spending executor time.',
    );
  }
  return {
    recommendation:
      task.scope === 'work' &&
      project !== null &&
      ready &&
      !TERMINAL_OR_ACTIVE.has(normalizedStatus(task)) &&
      task.points != null &&
      task.points > 0
        ? 'greenlight'
        : 'plan-first',
    reasons,
    executorReady: ready,
  };
}

export function getTaskDecision(id: string): DecisionGuidance | null {
  const task = taskFor(id);
  if (!task) return null;
  const project = projectFor(task);
  const existing = readTaskDecision(id);
  const executionPlan = readTaskPlan(id);
  const {
    recommendation,
    reasons,
    executorReady: ready,
  } = readiness(task, project);
  const mode = deliveryModeFor(project?.slug ?? null);
  const outboxState: OutboxState = project
    ? requestState(project.slug, String(task.id))
    : 'none';
  const greenlit = project
    ? greenlitFor(mode, outboxState, () => hasGreenlight(task, project.slug))
    : false;
  if (
    greenlit &&
    !reasons.some((reason) => reason.includes('current loop/board state'))
  ) {
    reasons.unshift(
      'This task is already on the project’s owner-maintained greenlight list.',
    );
  }
  if (!executionPlan && project) {
    reasons.push(
      'Choose and save a provider/model/effort plan before greenlighting.',
    );
  }

  const gatedRecommendation =
    executionPlan || !project ? recommendation : 'plan-first';

  const finalRecommendation =
    greenlit && gatedRecommendation === 'greenlight'
      ? 'greenlight'
      : gatedRecommendation;
  const title =
    finalRecommendation === 'greenlight'
      ? 'Ready for greenlight'
      : 'Plan first';
  const summary =
    finalRecommendation === 'greenlight'
      ? 'The task has enough metadata for one bounded loop iteration. Greenlighting only queues it; it does not start the loop or open a PR.'
      : 'Keep this task out of the execution queue until the readiness questions below are resolved.';
  const suggestedComment =
    finalRecommendation === 'greenlight'
      ? `Greenlight ${String(task.id)} for one bounded iteration. Scope: ${task.name}. ${
          reasons.length
            ? `Review notes: ${reasons.join(' ')}`
            : 'The task has a component, priority, and story-point estimate.'
        }`
      : `Plan first for ${String(task.id)}. ${reasons.join(' ') || 'Confirm acceptance criteria, owner, and verification before execution.'}`;

  return {
    recommendation: finalRecommendation,
    title,
    summary,
    reasons,
    suggestedComment,
    project: project?.slug ?? null,
    executorReady: ready,
    deliveryMode: mode,
    outboxState,
    greenlit,
    existing,
    executionPlan,
  };
}

/** Add an unclaimed task to the local executor's owner-maintained allowlist. */
export function addGreenlight(
  task: SprintTask,
  slug: string,
  plan: ExecutionPlan | null = null,
): { path: string; already: boolean } {
  const path = greenlightPath(slug);
  const current = greenlightText(slug);
  if (hasGreenlight(task, slug)) return { path, already: true };

  const lines = current
    ? current.split(/\r?\n/)
    : [`# ${slug} greenlight`, '', '## Cleared', ''];
  let cleared = lines.findIndex((line) =>
    /^##\s+Cleared\s*$/.test(line.trim()),
  );
  if (cleared === -1) {
    lines.push('', '## Cleared', '');
    cleared = lines.length - 2;
  }
  const placeholder = lines.findIndex(
    (line, index) => index > cleared && /^\s*_\(none\)/i.test(line),
  );
  if (placeholder !== -1) lines.splice(placeholder, 1);
  lines.splice(cleared + 1, 0, lineFor(task, slug, plan));

  const dir = greenlightDir();
  if (!existsSync(dir)) {
    // The parent directory is intentionally narrow and derived from HOME; do not
    // create arbitrary paths from task input.
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    path,
    `${lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '')}\n`,
    'utf-8',
  );
  return { path, already: false };
}

/**
 * Remove only an unclaimed entry when the owner changes their mind.
 *
 * Local delivery only. This writes *this host's* allowlist, so callers must
 * check `deliveryModeFor(slug) === 'local'` first: on the remote path the file
 * it reads is mini's own empty one, and it would return `removed: false` while
 * the real authorisation stood untouched on Air. `api/task-decision.ts` holds
 * that guard.
 */
export function removeGreenlight(
  task: SprintTask,
  slug: string,
): { path: string; removed: boolean; claimed: boolean } {
  const path = greenlightPath(slug);
  const current = greenlightText(slug);
  const id = escapeRegExp(String(task.id));
  const lines = current.split(/\r?\n/);
  const index = lines.findIndex((line) =>
    new RegExp(`^\\s*-\\s*${id}(?:\\s|—|$)`, 'i').test(line),
  );
  if (index === -1) return { path, removed: false, claimed: false };
  if (/\[(?:claimed|PR ready):/i.test(lines[index]))
    return { path, removed: false, claimed: true };
  lines.splice(index, 1);
  writeFileSync(
    path,
    `${lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '')}\n`,
    'utf-8',
  );
  return { path, removed: true, claimed: false };
}

export function resolveTaskDecision(id: string): {
  task: SprintTask;
  guidance: DecisionGuidance;
} | null {
  const task = taskFor(id);
  const guidance = task ? getTaskDecision(id) : null;
  return task && guidance ? { task, guidance } : null;
}
