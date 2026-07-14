import type { APIRoute } from 'astro';

import { noteHasFeedback } from '../../lib/taskNote.js';
import { readTasks } from '../../lib/tasks.js';

export const GET: APIRoute = () => {
  try {
    const data = readTasks();
    // `null` (no snapshot yet) is a valid response — the panel renders empty.
    if (!data) return Response.json(null);

    // Augment each task with a cheap "has pending feedback" flag read from its
    // local note, so cards/nodes can show a tuning indicator.
    data.tasks = data.tasks.map((t) => ({ ...t, hasFeedback: noteHasFeedback(t) }));
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
