import { parseSharedParams } from '@rainforest-dev/library-contract';
import { connection, NextResponse } from 'next/server';

import { withBase } from '@/lib';
import { searchNotebookPages } from '@/lib/server';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Page search for the library-wide search box: `q` (the shared parameter), optional `from` and
 * `to` page dates, and `exact=1` for words only. Each hit links to its page in the reader.
 */
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const q = (parseSharedParams(params).q ?? '').slice(0, 200);
  const date = (key: string) => {
    const value = params.get(key);
    return value && DATE.test(value) ? value : undefined;
  };
  const from = date('from');
  const to = date('to');
  const search = await searchNotebookPages(q, {
    ...(from && { from }),
    ...(to && { to }),
    ...(params.get('exact') === '1' && { exact: true }),
  });
  return NextResponse.json({
    ...search,
    hits: search.hits.map((hit) => ({
      ...hit,
      href: withBase(`/${hit.notebookId}?page=${hit.id}`),
    })),
  });
}
