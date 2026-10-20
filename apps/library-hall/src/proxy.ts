import { routeLibraryLocale } from '@rainforest-dev/library-contract';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Serves each page from its `[lang]` copy: the reader's pick in the prefs cookie, else the
 * browser's language. The rewrite never shows in the URL, and the pages stay static. A URL
 * that names a locale is redirected to the one that does not, so the cookie always decides.
 */
export function proxy(request: NextRequest) {
  const route = routeLibraryLocale(request.nextUrl.pathname, request.headers);
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  const response =
    route.kind === 'rewrite'
      ? NextResponse.rewrite(url)
      : NextResponse.redirect(url);
  response.headers.append('Vary', 'Cookie, Accept-Language');
  return response;
}

export const config = {
  // Pages only: not the APIs, Next's own files, or anything in `public`.
  matcher: ['/((?!api/|_next/|_shell/|oidn/|.*\\.).*)'],
};
