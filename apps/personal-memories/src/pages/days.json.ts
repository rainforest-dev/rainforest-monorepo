import type { APIRoute } from 'astro';

import { summarize } from '@/lib';
import { getDayIndex } from '@/lib/server';

export const GET: APIRoute = async () => {
  const index = await getDayIndex();
  const days = index
    ? summarize(index).map(({ date, total }) => ({ date, total }))
    : [];
  return Response.json(days, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
};
