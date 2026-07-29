import type { APIRoute } from 'astro';

import { statesForSlugs } from '../../lib/greenlightOutbox.js';
import { GREENLIGHT_TARGETS } from '../../lib/taskDecision.js';
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
    // One directory read per company slug, not one fs check per card.
    const slugs = new Set(
      data.tasks
        .map((t) => (t.component ? GREENLIGHT_TARGETS[t.component]?.slug : undefined))
        .filter((slug): slug is string => Boolean(slug)),
    );
    const outboxStates = statesForSlugs(slugs);

    data.tasks = data.tasks.map((t) => {
      const p = progress?.[String(t.id)];
      const slug = t.component ? GREENLIGHT_TARGETS[t.component]?.slug : undefined;
      return {
        ...t,
        hasFeedback: noteHasFeedback(t),
        loopStatus: p?.loop_status ?? null,
        pr: p?.pr ?? null,
        loopNote: p?.note ?? null,
        outboxState: slug ? (outboxStates.get(slug)?.[String(t.id)] ?? null) : null,
      };
    });
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
