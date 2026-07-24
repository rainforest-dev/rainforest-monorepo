import type { APIRoute } from 'astro';

import {
  isLoopAgent,
  readAgentConfig,
  setDefaultAgent,
  setTaskAgent,
} from '../../lib/agents.js';

function response() {
  const config = readAgentConfig();
  return {
    defaultAgent: config.default_agent,
    tasks: config.tasks,
  };
}

export const GET: APIRoute = () => Response.json(response());

export const POST: APIRoute = async ({ request }) => {
  let body: { id?: unknown; agent?: unknown; defaultAgent?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.defaultAgent !== undefined) {
      if (!isLoopAgent(body.defaultAgent)) {
        return Response.json({ error: 'defaultAgent must be claude, codex, or agy' }, { status: 400 });
      }
      setDefaultAgent(body.defaultAgent);
    }

    if (body.id !== undefined) {
      if (typeof body.id !== 'string' && typeof body.id !== 'number') {
        return Response.json({ error: 'id must be a string or number' }, { status: 400 });
      }
      if (body.agent !== null && !isLoopAgent(body.agent)) {
        return Response.json({ error: 'agent must be claude, codex, agy, or null' }, { status: 400 });
      }
      setTaskAgent(String(body.id), body.agent as 'claude' | 'codex' | 'agy' | null);
    }

    return Response.json(response());
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
};
