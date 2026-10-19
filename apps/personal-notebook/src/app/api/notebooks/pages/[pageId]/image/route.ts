import { NextResponse } from 'next/server';

import { readPageFile } from '@/lib/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const pageId = Number((await params).pageId);
  if (!Number.isSafeInteger(pageId) || pageId < 1) {
    return new NextResponse('Not Found', { status: 404 });
  }
  const file = await readPageFile(pageId);
  if (!file) return new NextResponse('Not Found', { status: 404 });

  // A replaced page keeps its id, so the browser revalidates by content hash instead of
  // caching the URL forever; an unchanged page costs a 304.
  const etag = `"${file.contentHash}"`;
  const cache = { ETag: etag, 'Cache-Control': 'private, no-cache' };
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: cache });
  }
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      ...cache,
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.byteLength),
    },
  });
}
