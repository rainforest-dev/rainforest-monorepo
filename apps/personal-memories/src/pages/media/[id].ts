import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';

import type { APIRoute } from 'astro';

import { parseRange } from '../../lib/range.ts';
import {
  contentType,
  dataDir,
  getTimeline,
  mediaFile,
} from '../../lib/store.ts';

const notFound = () => new Response('Not found', { status: 404 });

export const GET: APIRoute = ({ params, url, request }) => {
  const index = Number(url.searchParams.get('n') ?? 0);
  if (!params.id || !Number.isInteger(index) || index < 0) return notFound();

  const path = mediaFile(getTimeline(), dataDir(), params.id, index);
  if (!path || !existsSync(path)) return notFound();

  const size = statSync(path).size;
  const range = parseRange(request.headers.get('range'), size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const stream = Readable.toWeb(
    createReadStream(path, range && { start, end }),
  ) as ReadableStream;

  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': contentType(path),
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      ...(range && { 'Content-Range': `bytes ${start}-${end}/${size}` }),
    },
  });
};
