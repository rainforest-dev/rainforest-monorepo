import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getNotebook,
  NotebookNameTakenError,
  renameNotebook,
  setNotebookStatus,
} from '@/lib/server';
import type { Notebook } from '@/types';

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

const patchBodySchema = z
  .object({
    status: z.enum(['active', 'archived']).optional(),
    name: z.string().optional(),
  })
  .refine((body) => body.status !== undefined || body.name !== undefined);

/**
 * Archives a finished notebook (`{ "status": "archived" }`) or reopens it (`"active"`), and/or
 * renames it (`{ "name": "…" }`). A name another notebook has is a 409.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notebookId = Number((await params).id);
  if (!Number.isSafeInteger(notebookId) || notebookId < 1) {
    return NextResponse.json({ error: 'Invalid notebook id' }, { status: 400 });
  }
  const body = patchBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: 'Send a name, or a status of "active" or "archived"' },
      { status: 400 },
    );
  }
  const { name, status } = body.data;
  let notebook: Notebook | null = null;
  if (name !== undefined) {
    try {
      notebook = await renameNotebook(notebookId, name);
    } catch (error) {
      if (!(error instanceof ToolInputError)) throw error;
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof NotebookNameTakenError ? 409 : 400 },
      );
    }
    if (!notebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 },
      );
    }
  }
  if (status !== undefined) {
    notebook = await setNotebookStatus(notebookId, status);
  }
  if (!notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }
  return NextResponse.json({ notebook });
}
