import { defineMiddleware } from 'astro:middleware';

import { movedToLibrary } from '@/server';

/** The old hostname's pages answer with a permanent redirect into the library. */
export const onRequest = defineMiddleware((context, next) => {
  const moved = movedToLibrary(context.request.method, context.url);
  return moved ? context.redirect(moved, 301) : next();
});
