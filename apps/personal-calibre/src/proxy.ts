import { routeLibraryLocale } from '@rainforest-dev/library-contract';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Serves each page from its `[lang]` copy: the reader's pick in the prefs cookie, else the
 * browser's language. The rewrite never shows in the URL. A URL that names a locale is
 * redirected to the one that does not, so the cookie always decides. Paths here and in the
 * matcher are inside the base path, which Next strips before the proxy sees them.
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
  // Pages only: not the APIs, feeds, MCP, book files, Next's own files, or anything in `public`.
  // Next prefixes each entry with the base path, so `/books` itself needs `/` of its own: the
  // second entry only matches below it.
  matcher: [
    '/',
    '/((?!(?:api|files|opds|mcp)(?:/|$)|_next/|_shell/|oidn/|.*\\.).*)',
  ],
};
