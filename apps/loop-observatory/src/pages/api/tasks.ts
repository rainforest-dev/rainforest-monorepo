import type { APIRoute } from 'astro';

import { noteHasFeedback } from '../../lib/taskNote.js';
import { readTasks, readTasksProgress } from '../../lib/tasks.js';

export const GET: APIRoute = () => {
  try {
    const data = readTasks();
    // `null` (no snapshot yet) is a valid response — the panel renders empty.
    if (!data) return Response.json(null);

    // Loop-progress overlay (absent → no overlay, current behavior).
    const progress = readTasksProgress();

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
      };
    });
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
