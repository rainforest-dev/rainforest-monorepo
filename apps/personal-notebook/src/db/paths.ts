import path from 'node:path';

/** Page images, one folder per notebook id. */
export const pagesDir = (root: string): string => path.join(root, 'pages');

/** The page search index and its embeddings. */
export const searchDir = (root: string): string => path.join(root, 'search');
