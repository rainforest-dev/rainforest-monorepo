import { libraryLocaleOfRequest } from '@rainforest-dev/library-contract';
import { defineMiddleware } from 'astro:middleware';

import { movedToLibrary } from '@/server';

/**
 * The old hostname's pages answer with a permanent redirect into the library. Every other page
 * renders in the reader's locale: the pick in the prefs cookie, else the browser's language.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const moved = movedToLibrary(context.request.method, context.url);
  if (moved) return context.redirect(moved, 301);
  context.locals.locale = libraryLocaleOfRequest(context.request.headers);
  const response = await next();
  // Not on a redirect, whose headers are immutable.
  if (response.status < 300 || response.status >= 400)
    response.headers.append('Vary', 'Cookie, Accept-Language');
  return response;
});
