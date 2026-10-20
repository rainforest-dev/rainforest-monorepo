import {
  LIBRARY_LOCALE_HEADER,
  routeLibraryLocale,
} from '@rainforest-dev/library-contract';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Serves each page from its `[lang]` copy: the reader's pick in the prefs cookie, else the
 * browser's language. The rewrite never shows in the URL, and the pages stay static. A URL
 * that names a locale is redirected to the one that does not, so the cookie always decides.
 */
export function proxy(request: NextRequest) {
  const route = routeLibraryLocale(request.nextUrl.pathname, request.headers);
  // The standalone server runs the proxy again on its own rewrite, marked below.
  if (route.kind === 'next') return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  let response: NextResponse;
  if (route.kind === 'rewrite') {
    const headers = new Headers(request.headers);
    headers.set(LIBRARY_LOCALE_HEADER, route.locale);
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.redirect(url);
  }
  response.headers.append('Vary', 'Cookie, Accept-Language');
  return response;
}

export const config = {
  // Pages only: not the APIs, Next's own files, or anything in `public`.
  matcher: ['/((?!api/|_next/|_shell/|oidn/|.*\\.).*)'],
};
