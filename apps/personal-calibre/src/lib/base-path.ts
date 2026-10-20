import { getCollection } from '@rainforest-dev/library-contract';

/** Where the app is mounted, as `basePath` in next.config. */
export const BASE_PATH = getCollection('books').basePath;

/**
 * Prefixes a path inside the app with its mount. `<Link>`, `router.push` and `redirect` add it
 * themselves; `fetch`, `<a href>`, `<img src>` and links written into feeds do not.
 */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;
