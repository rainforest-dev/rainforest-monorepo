import { NextResponse } from 'next/server';

import { getNotebook } from '@/lib/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notebookId = Number((await params).id);
  if (!Number.isSafeInteger(notebookId) || notebookId < 1) {
    return NextResponse.json({ error: 'Invalid notebook id' }, { status: 400 });
  }
  const notebook = await getNotebook(notebookId);
  if (!notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }
  return NextResponse.json({ notebook });
}
