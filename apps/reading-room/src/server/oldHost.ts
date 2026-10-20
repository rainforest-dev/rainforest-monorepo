import { LIBRARY_ORIGIN } from '@rainforest-dev/library-contract';

import { RACK_PATH, SOURCES_PATH } from '@/lib';

/** The app's own hostname before the library. */
export const OLD_HOST = 'rss.rainforest.tools';

/**
 * Where a request to the old hostname now lives in the library, or null when it stays. Pages
 * move; API calls stay, so a page still open from before keeps working. `/` was the registry
 * desk, so a query keeps going there and a bare visit opens the rack, as `index.astro` does.
 */
export function movedToLibrary(method: string, url: URL): string | null {
  if (url.hostname !== OLD_HOST) return null;
  if (method !== 'GET' && method !== 'HEAD') return null;
  if (/^\/(rack|kb)\/api(\/|$)/.test(url.pathname)) return null;
  const path =
    url.pathname === '/'
      ? url.search
        ? `${SOURCES_PATH}${url.search}`
        : RACK_PATH
      : `${url.pathname}${url.search}`;
  return `${LIBRARY_ORIGIN}${path}`;
}
