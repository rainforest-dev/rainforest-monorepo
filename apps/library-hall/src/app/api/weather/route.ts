import { connection } from 'next/server';

import { loadWeather } from '@/lib/server';

/** The weather over the hall now, or `null` when it cannot be had; the sky is clear then. */
export async function GET() {
  await connection();
  const weather = await loadWeather();
  return Response.json(
    { weather },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
