import { NextResponse } from 'next/server';

import { movedNotebookUrl } from '@/lib/server';

/** Notebooks live in personal-notebook now; old links land there. */
export function GET(request: Request) {
  const moved = movedNotebookUrl(request.url);
  return moved
    ? NextResponse.redirect(moved, 308)
    : new NextResponse('Not Found', { status: 404 });
}
