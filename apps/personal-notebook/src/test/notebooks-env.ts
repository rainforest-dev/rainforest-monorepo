import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

/**
 * Points the app at a fresh data directory in a temp dir: an empty DB and page store. Call it
 * from `beforeAll`, before the first query opens the DB. Returns the page store root.
 */
export function setUpNotebookShelf(prefix = 'notebook-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.NOTEBOOK_DATA_DIR = dir;
  return path.join(dir, 'pages');
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
