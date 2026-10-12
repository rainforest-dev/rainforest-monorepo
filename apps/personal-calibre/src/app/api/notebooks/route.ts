import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { connection, NextResponse } from 'next/server';
import { z } from 'zod';

import { createNotebook, listNotebooks } from '@/lib/server';

export const notebookBodySchema = z.object({
  name: z
    .string({ error: 'name is required' })
    .trim()
    .min(1, 'name is required')
    .max(120, 'name is longer than 120 characters'),
});

export async function GET() {
  await connection();
  return NextResponse.json({ notebooks: await listNotebooks() });
}

export async function POST(request: Request) {
  const parsed = notebookBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 422 });
  }
  try {
    const notebook = await createNotebook(parsed.data.name);
    return NextResponse.json({ notebook }, { status: 201 });
  } catch (error) {
    if (error instanceof ToolInputError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
