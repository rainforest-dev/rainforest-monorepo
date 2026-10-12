import { NextResponse } from 'next/server';

import { readPageFile } from '@/lib/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const pageId = Number((await params).pageId);
  if (!Number.isSafeInteger(pageId) || pageId < 1) {
    return new NextResponse('Not Found', { status: 404 });
  }
  const file = await readPageFile(pageId);
  if (!file) return new NextResponse('Not Found', { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.byteLength),
      // A page id never points at different bytes: re-uploads dedup and ids are not reused.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
