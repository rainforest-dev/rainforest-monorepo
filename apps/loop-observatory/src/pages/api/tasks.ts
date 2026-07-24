import type { APIRoute } from 'astro';

import { readAgentConfig } from '../../lib/agents.js';
import { noteHasFeedback } from '../../lib/taskNote.js';
import { readTasks, readTasksProgress } from '../../lib/tasks.js';

export const GET: APIRoute = () => {
  try {
    const data = readTasks();
    // `null` (no snapshot yet) is a valid response — the panel renders empty.
    if (!data) return Response.json(null);

    // Loop-progress overlay (absent → no overlay, current behavior).
    const progress = readTasksProgress();
    const agentConfig = readAgentConfig();

    // Augment each task with a cheap "has pending feedback" flag (from its local
    // note) and the loop-progress overlay merged by matching task id.
    data.tasks = data.tasks.map((t) => {
      const p = progress?.[String(t.id)];
      return {
        ...t,
        hasFeedback: noteHasFeedback(t),
        loopStatus: p?.loop_status ?? null,
        pr: p?.pr ?? null,
        loopNote: p?.note ?? null,
        agent: p?.agent ?? agentConfig.tasks[String(t.id)] ?? agentConfig.default_agent,
      };
    });
    data.defaultAgent = agentConfig.default_agent;
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
