import type { APIRoute } from 'astro';

import { eventCover, loadEvents } from '@/server';

const MISSING = {
  status: 404,
  headers: { 'Cache-Control': 'public, max-age=3600' },
};

/**
 * An event's picture, from the library's own origin so the hall can draw it in 3D. Only an
 * event's own picture is served, never an arbitrary URL, and it is served as an inert image.
 */
export const GET: APIRoute = async ({ params }) => {
  const id = params['id'];
  if (!id) return new Response(null, MISSING);
  try {
    const { events } = await loadEvents();
    const event = events.find((e) => e.id === id);
    if (!event?.image) return new Response(null, MISSING);
    const cover = await eventCover(event, fetch, Date.now(), {
      allowPrivate: process.env['EVENTS_PAGES_PRIVATE']?.trim() === 'allow',
    });
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
