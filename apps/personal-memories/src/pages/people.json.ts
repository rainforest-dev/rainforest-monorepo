import type { APIRoute } from 'astro';

import { getPeople, publicPeople } from '@/lib/server';

export const GET: APIRoute = async () =>
  Response.json(publicPeople(await getPeople()), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
