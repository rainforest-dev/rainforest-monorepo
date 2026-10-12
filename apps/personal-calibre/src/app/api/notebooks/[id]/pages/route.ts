import { NextResponse } from 'next/server';

import { appendPages, getNotebook, readPageUploads } from '@/lib/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notebookId = Number((await params).id);
  if (!Number.isSafeInteger(notebookId) || notebookId < 1) {
    return NextResponse.json({ error: 'Invalid notebook id' }, { status: 400 });
  }
  if (!(await getNotebook(notebookId))) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: 'Expected a multipart form' },
      { status: 400 },
    );
  }
  const read = await readPageUploads(form);
  if (!read.ok) {
    return NextResponse.json({ error: read.message }, { status: read.status });
  }

  const result = await appendPages(notebookId, read.uploads, 'upload');
  return NextResponse.json({ notebookId, ...result });
}
