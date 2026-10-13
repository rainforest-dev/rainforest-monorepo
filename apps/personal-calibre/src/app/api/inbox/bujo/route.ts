import { gatewayAuth } from '@rainforest-dev/mcp-kit';
import { NextResponse } from 'next/server';

import {
  appendPages,
  findOrCreateNotebookByName,
  readPageUploads,
} from '@/lib/server';

const INBOX_HEADER = 'x-inbox-secret';

/**
 * Takes scanned Bullet Journal pages from automation (n8n): multipart `notebook` (a name, found
 * or created), one or more `file` fields and an optional `source`. It answers 404 while
 * `CALIBRE_INBOX_SECRET` is unset, and 401 without the matching `x-inbox-secret` header.
 */
export async function POST(request: Request) {
  const auth = await gatewayAuth({
    header: INBOX_HEADER,
    secret: process.env.CALIBRE_INBOX_SECRET,
  })(request);
  if (auth.status === 'disabled') {
    return new NextResponse('Not Found', { status: 404 });
  }
  if (auth.status === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: 'Expected a multipart form' },
      { status: 400 },
    );
  }
  const name = form.get('notebook');
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { error: 'notebook is required' },
      { status: 400 },
    );
  }
  if (name.trim().length > 120) {
    return NextResponse.json(
      { error: 'notebook is longer than 120 characters' },
      { status: 400 },
    );
  }
  const read = await readPageUploads(form);
  if (!read.ok) {
    return NextResponse.json({ error: read.message }, { status: read.status });
  }
  const source = form.get('source');

  const notebook = await findOrCreateNotebookByName(name);
  const result = await appendPages(
    notebook.id,
    read.uploads,
    typeof source === 'string' && source.trim() ? source : 'inbox',
  );
  return NextResponse.json({ notebookId: notebook.id, ...result });
}
