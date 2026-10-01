import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { bulkCreateDeliveryEvents } from '@/lib/server/delivery';
import { httpUrlSchema } from '@/lib/url';

const externalRefSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  httpUrlSchema.optional(),
);

export const bulkDeliveryBodySchema = z.object({
  bookIds: z
    .array(z.number().int().positive())
    .min(1, 'bookIds must be a non-empty array')
    .max(1000, 'bookIds must have at most 1000 items'),
  platformKey: z
    .string({ required_error: 'platformKey is required' })
    .trim()
    .min(1, 'platformKey is required'),
  note: z.string().trim().max(2000).optional(),
  externalRef: externalRefSchema,
});

export async function POST(request: NextRequest) {
  const parsed = bulkDeliveryBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  try {
    const { bookIds, ...input } = parsed.data;
    const result = await bulkCreateDeliveryEvents(bookIds, input);
    return NextResponse.json(
      { ok: true, count: result.count },
      { status: 201 },
    );
  } catch (error) {
    console.error('bulkCreateDeliveryEvents failed', error);
    return NextResponse.json(
      { error: 'Failed to create delivery events' },
      { status: 400 },
    );
  }
}
