import type { HallItemsResponse } from '@rainforest-dev/library-contract';
import { connection } from 'next/server';

import { listBookHallItems } from '@/lib/server';

/** This collection's shelf for the library hall, which fetches it server-side. */
export async function GET() {
  await connection();
  const body: HallItemsResponse = { items: listBookHallItems() };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
