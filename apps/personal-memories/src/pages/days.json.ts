import type { APIRoute } from 'astro';

import { indexDays, summarize } from '../lib/days.ts';
import { getTimeline } from '../lib/store.ts';

export const GET: APIRoute = () => {
  const state = getTimeline();
  const days =
    state.status === 'ready'
      ? summarize(indexDays(state.timeline.events)).map(({ date, total }) => ({
          date,
          total,
        }))
      : [];
  return Response.json(days, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
};
