import {
  isLibraryLocale,
  libraryLocaleOfRequest,
} from '@rainforest-dev/library-contract';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Serves each page from its `[lang]` copy: the reader's pick in the prefs cookie, else the
 * browser's language. The rewrite never shows in the URL, and the pages stay static.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLibraryLocale(pathname.split('/')[1])) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${libraryLocaleOfRequest(request.headers)}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.append('Vary', 'Cookie, Accept-Language');
  return response;
}

export const config = {
  // Pages only: not the APIs, Next's own files, or anything in `public`.
  matcher: ['/((?!api/|_next/|_shell/|oidn/|.*\\.).*)'],
};
