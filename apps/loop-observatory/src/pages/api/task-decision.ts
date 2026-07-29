import type { APIRoute } from 'astro';

import { writeRequest } from '../../lib/greenlightOutbox.js';
import {
  addGreenlight,
  getTaskDecision,
  REMOTE_EXECUTORS,
  removeGreenlight,
  resolveTaskDecision,
} from '../../lib/taskDecision.js';
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

    // Revocation only exists for local delivery. removeGreenlight writes this
    // host's allowlist; on the remote path that file is mini's own empty one,
    // so calling it would find nothing, return removed:false, and let the
    // drawer report "Decision saved." while Air's authorisation stood. Rather
    // than invent a revocation protocol, say plainly where the entry lives.
    let revoked = false;
    if (guidance.project && guidance.deliveryMode === 'local') {
      const result = removeGreenlight(task, guidance.project);
      revoked = result.removed;
      if (result.claimed) {
        return Response.json(
          { error: 'This task is already claimed or PR-ready; planning first cannot revoke it.', ...guidance },
          { status: 409 },
        );
      }
    }

    const remoteExecutor = guidance.project ? (REMOTE_EXECUTORS[guidance.project] ?? null) : null;
    const remoteHeld =
      guidance.deliveryMode === 'remote-queue' &&
      (guidance.outboxState === 'applied' || guidance.outboxState === 'duplicate');

    writeTaskDecision(id, 'plan-first', comment || guidance.suggestedComment);
    return Response.json({
      ok: true,
      decision,
      queued: false,
      revoked,
      remoteHeld,
      revocationNote: remoteHeld
        ? `“Plan first” is recorded here, but it does not withdraw the authorisation: ${
            remoteExecutor ?? 'the remote executor'
          } has already applied this task to its own allowlist, and only that machine can write it. Remove the entry there to actually revoke it.`
        : null,
      guidance: getTaskDecision(id),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
