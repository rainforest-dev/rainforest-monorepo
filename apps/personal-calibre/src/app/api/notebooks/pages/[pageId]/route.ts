import { NextResponse } from 'next/server';

import { deletePage } from '@/lib/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const pageId = Number((await params).pageId);
  if (!Number.isSafeInteger(pageId) || pageId < 1) {
    return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
  }
  if (!(await deletePage(pageId))) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
