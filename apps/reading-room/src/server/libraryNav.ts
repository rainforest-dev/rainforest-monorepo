import { LIBRARY_HOST } from '@rainforest-dev/library-contract';

/**
 * Whether a page links the library's other collections. They are served only on the library
 * hostname; the old `rss.rainforest.tools` reaches this app alone. `LIBRARY_NAV=on` turns the
 * links on anywhere, for local runs and the e2e suite.
 */
export function showsCollections(url: URL): boolean {
  return url.hostname === LIBRARY_HOST || process.env.LIBRARY_NAV === 'on';
}
