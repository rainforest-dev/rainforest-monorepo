import { NextResponse } from 'next/server';

import { revalidateBookTagCache, removeTagFromBook } from '@/lib/tags';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const { id, tagId } = await params;
  const bookId = Number(id);
  const tagIdNum = Number(tagId);
  if (!Number.isFinite(bookId) || !Number.isFinite(tagIdNum)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    removeTagFromBook(bookId, tagIdNum);
    revalidateBookTagCache(bookId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
