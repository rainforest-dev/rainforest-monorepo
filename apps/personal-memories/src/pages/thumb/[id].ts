import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';

import type { APIRoute } from 'astro';

import { dataDir, getTimeline, mediaFile } from '../../lib/store.ts';
import {
  ensureThumb,
  parseWidth,
  thumbCacheDir,
  thumbPath,
} from '../../lib/thumbs.ts';

const notFound = () => new Response('Not found', { status: 404 });
const badRequest = () => new Response('Bad request', { status: 400 });

export const GET: APIRoute = async ({ params, url }) => {
  const index = Number(url.searchParams.get('n') ?? 0);
  if (!params.id || !Number.isInteger(index) || index < 0) return notFound();

  const width = parseWidth(url.searchParams.get('w'));
  if (!width) return badRequest();

  const src = mediaFile(getTimeline(), dataDir(), params.id, index);
  if (!src || !existsSync(src)) return notFound();

  const dest = thumbPath(
    thumbCacheDir(),
    params.id,
    index,
    width,
    statSync(src).mtimeMs,
  );
  try {
    await ensureThumb(src, dest, width);
  } catch {
    const suffix = index > 0 ? `?n=${index}` : '';
    return new Response(null, {
      status: 302,
      headers: { Location: `/media/${params.id}${suffix}` },
    });
  }

  const stream = Readable.toWeb(createReadStream(dest)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(statSync(dest).size),
      'Cache-Control': 'private, max-age=86400',
    },
  });
};
