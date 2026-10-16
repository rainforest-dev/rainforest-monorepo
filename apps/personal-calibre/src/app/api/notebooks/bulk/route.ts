import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { applyNotebookBulkAction } from '@/lib/server';

const bodySchema = z.object({
  action: z.enum(['archive', 'reopen', 'trash', 'restore', 'delete', 'merge']),
  ids: z.array(z.number().int().positive()).min(1).max(500),
  targetId: z.number().int().positive().optional(),
});

/**
 * Runs one shelf action over the selected notebooks: archive, reopen, trash, restore, delete
 * (pages and images, no undo) or merge into `targetId`. Answers which ids changed and which
 * failed; a partial failure is still a 200.
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: 'Send an action and the notebook ids' },
      { status: 400 },
    );
  }
  const { action, ids, targetId } = body.data;
  try {
    return NextResponse.json(
      await applyNotebookBulkAction(action, ids, { targetId }),
    );
  } catch (error) {
    if (!(error instanceof ToolInputError)) throw error;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
