import type { APIRoute } from 'astro';

import {
  addGreenlight,
  getTaskDecision,
  removeGreenlight,
  resolveTaskDecision,
} from '../../lib/taskDecision.js';
import { writeRequest } from '../../lib/greenlightOutbox.js';
import { writeTaskDecision } from '../../lib/taskNote.js';

function jsonBody(value: unknown): { decision?: unknown; comment?: unknown } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as { decision?: unknown; comment?: unknown };
}

export const GET: APIRoute = ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'missing id' }, { status: 400 });
  try {
    const guidance = getTaskDecision(id);
    if (!guidance) return Response.json({ found: false, id }, { status: 404 });
    return Response.json({ found: true, id, ...guidance });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ url, request }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'missing id' }, { status: 400 });

  let body: { decision?: unknown; comment?: unknown } | null;
  try {
    body = jsonBody(await request.json());
  } catch {
    body = null;
  }
  const decision = body?.decision;
  if (decision !== 'greenlight' && decision !== 'plan-first') {
    return Response.json({ error: 'decision must be greenlight or plan-first' }, { status: 400 });
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

  try {
    const resolved = resolveTaskDecision(id);
    if (!resolved) return Response.json({ found: false, id }, { status: 404 });
    const { task, guidance } = resolved;
    if (decision === 'greenlight') {
      if (guidance.recommendation !== 'greenlight' || !guidance.project) {
        return Response.json(
          {
            error: 'This task is not ready for greenlight. Resolve the planning notes first.',
            ...guidance,
          },
          { status: 409 },
        );
      }
      if (guidance.deliveryMode === 'remote-queue') {
        const request = writeRequest(
          task,
          guidance.project,
          guidance.executionPlan,
          comment || guidance.suggestedComment,
        );
        writeTaskDecision(id, 'greenlight', comment || guidance.suggestedComment);
        return Response.json({
          ok: true,
          decision,
          queued: true,
          delivery: 'remote-queue',
          requestedAt: request.requestedAt,
          guidance: getTaskDecision(id),
        });
      }
      const result = addGreenlight(task, guidance.project, guidance.executionPlan);
      writeTaskDecision(id, 'greenlight', comment || guidance.suggestedComment);
      return Response.json({
        ok: true,
        decision,
        queued: true,
        delivery: 'local',
        already: result.already,
        greenlightPath: result.path,
        guidance: getTaskDecision(id),
      });
    }

    let revoked = false;
    let held = false;
    if (guidance.project) {
      const result = removeGreenlight(task, guidance.project);
      revoked = result.removed;
      held = result.claimed;
      if (held) {
        return Response.json(
          { error: 'This task is already claimed or PR-ready; planning first cannot revoke it.', ...guidance },
          { status: 409 },
        );
      }
    }
    writeTaskDecision(id, 'plan-first', comment || guidance.suggestedComment);
    return Response.json({
      ok: true,
      decision,
      queued: false,
      revoked,
      guidance: getTaskDecision(id),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
