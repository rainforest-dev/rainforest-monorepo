import { NextResponse } from 'next/server';
import { z } from 'zod';

import { addTagToBook, getOrCreateTag, revalidateBookTagCache } from '@/lib/tags';

const bodySchema = z.object({ name: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) return NextResponse.json({ error: 'Invalid book id' }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  try {
    const tagId = getOrCreateTag(parsed.data.name);
    addTagToBook(bookId, tagId);
    revalidateBookTagCache(bookId);
    return NextResponse.json({ ok: true, tagId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
