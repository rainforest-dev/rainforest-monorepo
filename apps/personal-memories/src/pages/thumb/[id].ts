import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import type { APIRoute } from 'astro';

import {
  dataDir,
  ensureThumb,
  getTimeline,
  localFile,
  mediaFile,
  NOT_LOCAL_SVG,
  parseWidth,
  thumbCacheDir,
  thumbPath,
} from '@/lib/server';

const notFound = () => new Response('Not found', { status: 404 });
const badRequest = () => new Response('Bad request', { status: 400 });
const notLocal = () =>
  new Response(NOT_LOCAL_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store',
      'X-Memories-Media': 'not-local',
    },
  });

export const GET: APIRoute = async ({ params, url }) => {
  const index = Number(url.searchParams.get('n') ?? 0);
  if (!params.id || !Number.isInteger(index) || index < 0) return notFound();

  const width = parseWidth(url.searchParams.get('w'));
  if (!width) return badRequest();

  const src = mediaFile(getTimeline(), dataDir(), params.id, index);
  if (!src) return notFound();
  const source = await localFile(src);
  if (!source) return notLocal();

  const dest = thumbPath(
    thumbCacheDir(),
    params.id,
    index,
    width,
    source.mtimeMs,
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

  const thumb = await localFile(dest);
  if (!thumb) return notLocal();
  const stream = Readable.toWeb(createReadStream(dest)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(thumb.size),
      'Cache-Control': 'private, max-age=86400',
    },
  });
};
