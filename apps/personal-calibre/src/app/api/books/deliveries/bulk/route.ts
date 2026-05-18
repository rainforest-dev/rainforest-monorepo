import { type NextRequest, NextResponse } from 'next/server';

import { bulkCreateDeliveryEvents } from '@/lib/delivery';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    bookIds?: unknown;
    platformKey?: string;
    note?: string;
  };

  if (!Array.isArray(body.bookIds) || body.bookIds.length === 0) {
    return NextResponse.json({ error: 'bookIds must be a non-empty array' }, { status: 400 });
  }

  const bookIds = body.bookIds as number[];
  if (bookIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json({ error: 'All bookIds must be integers' }, { status: 400 });
  }

  if (!body.platformKey) {
    return NextResponse.json({ error: 'platformKey is required' }, { status: 400 });
  }

  try {
    const result = await bulkCreateDeliveryEvents(bookIds, {
      platformKey: body.platformKey,
      note: body.note,
    });
    return NextResponse.json({ ok: true, count: result.count }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery events';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
