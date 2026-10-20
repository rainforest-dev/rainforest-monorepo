import { NextResponse } from 'next/server';

import { forwardToNotebook } from '@/lib/server';

/**
 * The inbox moved to personal-notebook (`/notebooks/api/inbox/bujo`). Automation that still posts
 * here is passed through until it points at the new app; 404 while `NOTEBOOK_INTERNAL_URL` is
 * unset, as the old endpoint answered without its secret.
 */
export async function POST(request: Request) {
  return (
    (await forwardToNotebook(request, '/api/inbox/bujo')) ??
    new NextResponse('Not Found', { status: 404 })
  );
}
