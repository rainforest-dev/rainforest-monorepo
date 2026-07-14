import type { APIRoute } from 'astro';

import { readTaskNote } from '../../lib/taskNote.js';

export const GET: APIRoute = ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'missing id' }, { status: 400 });
  }
  try {
    const note = readTaskNote(id);
    if (!note) {
      // Unknown task, unresolvable path, or missing file.
      return Response.json({ found: false, id }, { status: 404 });
    }
    return Response.json({ found: true, ...note });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
