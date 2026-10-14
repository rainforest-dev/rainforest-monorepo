import { NextResponse } from 'next/server';

import { notebookPdfFileName } from '@/lib';
import { getNotebook, notebookPdf, readPageFile } from '@/lib/server';

/** The whole notebook as one PDF download, merged from its scans on every request. */
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
  if (notebook.pages.length === 0) {
    return NextResponse.json(
      { error: 'This notebook has no pages yet' },
      { status: 409 },
    );
  }

  // Resolved before the response starts, so an unreadable notebook is a 409, not a broken file.
  const pages = await notebookPdf({
    title: notebook.name,
    pages: notebook.pages,
    readPage: readPageFile,
  });
  if (!pages) {
    return NextResponse.json(
      { error: "None of this notebook's page images can be read" },
      { status: 409 },
    );
  }
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await pages.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await pages.return(undefined);
    },
  });
  const fileName = notebookPdfFileName(notebook);
  const asciiName = fileName.replace(/[^\x20-\x7E]|["\\]/g, '_');
  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
