import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';

import type { APIRoute } from 'astro';

import {
  contentType,
  dataDir,
  getTimeline,
  mediaFile,
} from '../../lib/store.ts';

const notFound = () => new Response('Not found', { status: 404 });

export const GET: APIRoute = ({ params, url }) => {
  const index = Number(url.searchParams.get('n') ?? 0);
  if (!params.id || !Number.isInteger(index) || index < 0) return notFound();

  const path = mediaFile(getTimeline(), dataDir(), params.id, index);
  if (!path || !existsSync(path)) return notFound();

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': contentType(path),
      'Content-Length': String(statSync(path).size),
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
