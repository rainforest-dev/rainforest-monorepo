import type { APIRoute } from 'astro';

import { eventCover, readReadingQueueWithImages } from '@/server';

const MISSING = {
  status: 404,
  headers: { 'Cache-Control': 'public, max-age=3600' },
};

/** Astro hands the segment over still percent-encoded, as `articleCoverHref` wrote it. */
function decodedId(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * A queued article's picture, from the library's own origin so the hall can draw it in 3D. Only
 * an article's own picture is served, never an arbitrary URL, and it is served as an inert image.
 */
export const GET: APIRoute = async ({ params }) => {
  const id = decodedId(params['id']);
  if (!id) return new Response(null, MISSING);
  try {
    const item = readReadingQueueWithImages()?.queue.find((a) => a.id === id);
    if (!item?.imageUrl) return new Response(null, MISSING);
    const cover = await eventCover(
      { image: item.imageUrl },
      fetch,
      Date.now(),
      {
        allowPrivate: process.env['EVENTS_PAGES_PRIVATE']?.trim() === 'allow',
      },
    );
    if (!cover) return new Response(null, MISSING);
    return new Response(cover.bytes, {
      headers: {
        'Content-Type': cover.type,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
};
