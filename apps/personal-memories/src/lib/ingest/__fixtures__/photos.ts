import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Writes an osxphotos-style `photos/index.json` under `root`, pointing at two
 * generated 1×1 images, and returns the image paths.
 */
export function writePhotoFixture(root: string) {
  const library = join(root, 'Photos Library.photoslibrary');
  const original = join(library, 'originals', 'A', 'IMG_0001.png');
  const derivative = join(
    library,
    'resources',
    'derivatives',
    'B',
    'B_1_105_c.png',
  );
  for (const path of [original, derivative]) {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, PIXEL_PNG);
  }

  const items = [
    {
      uuid: 'AAAAAAAA-0000-0000-0000-000000000001',
      date: '2025-11-01T10:15:00.250000+08:00',
      original_filename: 'IMG_0001.png',
      path: original,
      path_edited: null,
      path_derivatives: [],
      ismissing: false,
      albums: ['Weekend', 'Food'],
      persons: ['Alice'],
      favorite: true,
      width: 1,
      height: 1,
      score: { overall: 0.82 },
      screenshot: false,
      ismovie: false,
      burst: false,
      some_future_field: { ignored: true },
    },
    {
      uuid: 'BBBBBBBB-0000-0000-0000-000000000002',
      date: '2025-11-01T01:30:00-01:00',
      original_filename: 'IMG_0002.HEIC',
      path: null,
      path_edited: null,
      path_derivatives: [derivative],
      ismissing: true,
      albums: [],
      persons: [],
      favorite: false,
      width: 4032,
      height: 3024,
      score: { overall: 0.4 },
      screenshot: true,
      ismovie: false,
      burst: true,
      burst_selected: false,
    },
    {
      uuid: 'CCCCCCCC-0000-0000-0000-000000000003',
      date: '2025-11-02T08:00:00+08:00',
      original_filename: 'IMG_0003.HEIC',
      path: null,
      path_edited: null,
      path_derivatives: [],
      ismissing: true,
      albums: ['Weekend'],
      persons: [],
      favorite: false,
      width: 4032,
      height: 3024,
    },
  ];

  mkdirSync(join(root, 'photos'), { recursive: true });
  writeFileSync(
    join(root, 'photos', 'index.json'),
    JSON.stringify(items, null, 2),
  );
  return { original, derivative };
}
