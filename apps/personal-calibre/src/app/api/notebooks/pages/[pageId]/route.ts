import { NextResponse } from 'next/server';

import { deletePage, readPageUploads, replacePage } from '@/lib/server';

const parsePageId = async (params: Promise<{ pageId: string }>) => {
  const pageId = Number((await params).pageId);
  return Number.isSafeInteger(pageId) && pageId >= 1 ? pageId : null;
};

/** Replaces the page's image with one uploaded `file`, keeping its place in the notebook. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const pageId = await parsePageId(params);
  if (pageId === null) {
    return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
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
  if (read.uploads.length !== 1) {
    return NextResponse.json(
      { error: 'A page is replaced by exactly one image' },
      { status: 400 },
    );
  }
  const result = await replacePage(pageId, read.uploads[0]);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json({ page: result.page });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const pageId = await parsePageId(params);
  if (pageId === null) {
    return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
  }
  if (!(await deletePage(pageId))) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
