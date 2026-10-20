import { getCollection } from '@rainforest-dev/library-contract';

/** Where the app is mounted, as `basePath` in next.config. */
export const BASE_PATH = getCollection('notebooks').basePath;

/**
 * Prefixes a path inside the app with its mount. `<Link>` and `router.push` add it themselves;
 * `fetch`, `<a href>`, `<img src>` and form actions do not.
 */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;
