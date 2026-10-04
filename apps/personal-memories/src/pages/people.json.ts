import type { APIRoute } from 'astro';

import { getPeople, publicPeople } from '@/lib/server';

export const GET: APIRoute = () =>
  Response.json(publicPeople(getPeople()), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
