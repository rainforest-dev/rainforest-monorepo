import type { APIRoute } from 'astro';

import { readMachineBudgets } from '../../lib/budget.js';
import { readTaskPlan, writeTaskPlan } from '../../lib/taskNote.js';
import { suggestTaskPlans, type ExecutionPlan } from '../../lib/taskPlan.js';
import { readTasks } from '../../lib/tasks.js';

function findTask(id: string) {
  return readTasks()?.tasks.find((task) => String(task.id) === id) ?? null;
}

function bodyPlan(value: unknown): ExecutionPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const plan = value as Record<string, unknown>;
  if (
    typeof plan.provider !== 'string' ||
    typeof plan.model !== 'string' ||
    typeof plan.effort !== 'string' ||
    typeof plan.inputTokens !== 'number' ||
    typeof plan.outputTokens !== 'number' ||
    typeof plan.maxMinutes !== 'number' ||
    typeof plan.quotaWindow !== 'string' ||
    typeof plan.rationale !== 'string'
  ) {
    return null;
  }
  return {
    provider: plan.provider as ExecutionPlan['provider'],
    model: plan.model,
    effort: plan.effort as ExecutionPlan['effort'],
    inputTokens: plan.inputTokens,
    outputTokens: plan.outputTokens,
    maxMinutes: plan.maxMinutes,
    quotaWindow: plan.quotaWindow,
    fallback: typeof plan.fallback === 'string' ? plan.fallback : null,
    rationale: plan.rationale,
  };
}

export const GET: APIRoute = ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'missing id' }, { status: 400 });
  const task = findTask(id);
  if (!task) return Response.json({ found: false, id }, { status: 404 });
  const suggested = suggestTaskPlans(task, readMachineBudgets());
  return Response.json({ found: true, id, ...suggested, saved: readTaskPlan(id) });
};

export const POST: APIRoute = async ({ url, request }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'missing id' }, { status: 400 });
  const task = findTask(id);
  if (!task) return Response.json({ found: false, id }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const plan = bodyPlan(body && typeof body === 'object' ? (body as Record<string, unknown>).plan : null);
  if (!plan) return Response.json({ error: 'invalid execution plan' }, { status: 400 });

  const suggestions = suggestTaskPlans(task, readMachineBudgets()).candidates;
  const accepted = suggestions.find(
    (candidate) =>
      candidate.provider === plan.provider &&
      candidate.model === plan.model &&
      candidate.effort === plan.effort,
  );
  if (!accepted) return Response.json({ error: 'plan is not one of the current provider options' }, { status: 409 });

  const saved = writeTaskPlan(id, accepted);
  if (!saved) return Response.json({ error: 'task note is unavailable' }, { status: 409 });
  return Response.json({ ok: true, id, plan: accepted });
};

