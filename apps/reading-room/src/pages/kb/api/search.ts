import type { APIRoute } from 'astro';

import { searchKb } from '@/lib/kb';
import { getKbIndex } from '@/server';

/**
 * `GET /kb/api/search?q=` answers `{ results }`, best first, for the library-wide search to
 * merge. Lexical only: titles and tags rank above body text.
 */
export const GET: APIRoute = ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  try {
    const results = searchKb(getKbIndex().entries, q).map(
      ({ doc, snippet }) => ({
        kind: 'kb',
        id: doc.id,
        title: doc.title,
        href: doc.href,
        source: doc.source,
        snippet,
      }),
    );
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
