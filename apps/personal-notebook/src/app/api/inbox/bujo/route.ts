import { gatewayAuth } from '@rainforest-dev/mcp-kit';
import { NextResponse } from 'next/server';

import {
  appendPages,
  autoCropPages,
  findOrCreateNotebookByName,
  readPageUploads,
} from '@/lib/server';

const INBOX_HEADER = 'x-inbox-secret';

/**
 * Takes scanned Bullet Journal pages from automation (n8n): multipart `notebook` (a name, found
 * or created), one or more `file` fields (page images, or a scanned PDF that is split into one
 * page per PDF page) and an optional `source`. Each page is cropped to the paper, a spread is
 * split into its pages and fingers are painted out of the margins (see `autoCropPage`), unless
 * `crop` is `off`. It answers 404 while
 * `NOTEBOOK_INBOX_SECRET` is unset, and 401 without the matching `x-inbox-secret` header.
 */
export async function POST(request: Request) {
  const auth = await gatewayAuth({
    header: INBOX_HEADER,
    secret: process.env.NOTEBOOK_INBOX_SECRET,
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

  const uploads =
    form.get('crop') === 'off'
      ? read.uploads
      : await autoCropPages(read.uploads);

  const notebook = await findOrCreateNotebookByName(name);
  const result = await appendPages(
    notebook.id,
    uploads,
    typeof source === 'string' && source.trim() ? source : 'inbox',
  );
  return NextResponse.json({ notebookId: notebook.id, ...result });
}
