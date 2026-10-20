import { connection, NextResponse } from 'next/server';

import { notebookHallItems } from '@/lib/server';

/** The notebooks for the hall's shelves, in library-contract's `hall-items` shape. */
export async function GET() {
  await connection();
  return NextResponse.json({ items: await notebookHallItems() });
}
