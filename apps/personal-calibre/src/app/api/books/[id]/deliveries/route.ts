import { type NextRequest, NextResponse } from 'next/server';

import {
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/delivery';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) {
    return NextResponse.json({ error: 'Invalid book id' }, { status: 400 });
  }

  const events = await listBookDeliveryEvents(bookId);
  return NextResponse.json({ events });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) {
    return NextResponse.json({ error: 'Invalid book id' }, { status: 400 });
  }

  const body = (await request.json()) as {
    platformKey?: string;
    note?: string;
    externalRef?: string;
  };

  if (!body.platformKey) {
    return NextResponse.json({ error: 'platformKey is required' }, { status: 400 });
  }

  try {
    await createBookDeliveryEvent(bookId, {
      platformKey: body.platformKey,
      note: body.note,
      externalRef: body.externalRef,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create delivery event';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) {
    return NextResponse.json({ error: 'Invalid book id' }, { status: 400 });
  }

  const deliveryId = Number(request.nextUrl.searchParams.get('deliveryId'));
  if (Number.isNaN(deliveryId)) {
    return NextResponse.json({ error: 'deliveryId is required' }, { status: 400 });
  }

  await deleteBookDeliveryEvent(bookId, deliveryId);
  return NextResponse.json({ ok: true });
}
