import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/delivery';
import { httpUrlSchema } from '@/lib/url';

const externalRefSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  httpUrlSchema.optional(),
);

export const deliveryBodySchema = z.object({
  platformKey: z
    .string({ required_error: 'platformKey is required' })
    .trim()
    .min(1, 'platformKey is required'),
  note: z.string().optional(),
  externalRef: externalRefSchema,
});

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

  const parsed = deliveryBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  try {
    await createBookDeliveryEvent(bookId, parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('createBookDeliveryEvent failed', error);
    return NextResponse.json(
      { error: 'Failed to create delivery event' },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: 'deliveryId is required' },
      { status: 400 },
    );
  }

  await deleteBookDeliveryEvent(bookId, deliveryId);
  return NextResponse.json({ ok: true });
}
