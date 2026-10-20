import { connection } from 'next/server';

import { loadHallItems } from '@/lib/server';

/** Every collection's shelf in one response, gathered server-side so the browser makes one request. */
export async function GET() {
  await connection();
  const result = await loadHallItems();
  return Response.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
