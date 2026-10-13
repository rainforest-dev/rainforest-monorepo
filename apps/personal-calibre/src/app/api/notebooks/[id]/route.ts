import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getNotebook, setNotebookStatus } from '@/lib/server';

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

const statusBodySchema = z.object({ status: z.enum(['active', 'archived']) });

/** Archives a finished notebook (`{ "status": "archived" }`) or reopens it (`"active"`). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notebookId = Number((await params).id);
  if (!Number.isSafeInteger(notebookId) || notebookId < 1) {
    return NextResponse.json({ error: 'Invalid notebook id' }, { status: 400 });
  }
  const body = statusBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: 'status must be "active" or "archived"' },
      { status: 400 },
    );
  }
  const notebook = await setNotebookStatus(notebookId, body.data.status);
  if (!notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }
  return NextResponse.json({ notebook });
}
