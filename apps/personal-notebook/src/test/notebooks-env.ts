import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

import { createCalibreDb } from './calibre-db';

/**
 * Points the app at an empty library, a fresh app DB and a fresh page store in a temp dir.
 * Call it from `beforeAll`, before the first query opens the DB. Returns the page store root.
 */
export function setUpNotebookShelf(prefix = 'calibre-notebooks-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const pagesRoot = path.join(dir, 'pages');
  process.env.CALIBRE_LIBRARY_PATH = createCalibreDb({
    authors: [],
    series: [],
    tags: [],
    books: [],
  });
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
  process.env.CALIBRE_NOTEBOOKS_DIR = pagesRoot;
  return pagesRoot;
}

/** A small real PNG page; `fill` sets its grey level, so different fills are different files. */
export async function pagePng(
  fill: number,
  { width = 8, height = 6 } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const png = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: fill, g: fill, b: fill },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}
