import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const TINY_MP4 = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMqbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAfQAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAfQAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAH0AAAAAAABAAAAAAHNbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAIABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAThzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMSBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZCWwEQAAAAwBAAAADAgPEiZIBAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAACmAAAAAAAAAABhzdHRzAAAAAAAAAAEAAAACAAAQAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAACjgAAAAoAAAAUc3RjbwAAAAAAAAABAAADWgAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDEAAAAIZnJlZQAAAqBtZGF0AAACcAYF//9s3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49NCBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAABZliIQEfEYoAApJxwABIpjgACWTJ114AAAABkGaOAh5YA==',
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

  const items: Record<string, unknown>[] = [
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

  const moviePath = join(library, 'originals', 'D', 'MOV_0001.mp4');
  mkdirSync(join(moviePath, '..'), { recursive: true });
  writeFileSync(moviePath, TINY_MP4);
  items.push({
    uuid: '99999999-0000-0000-0000-000000000009',
    date: '2025-11-02T20:50:00+08:00',
    original_filename: 'MOV_0001.mp4',
    path: moviePath,
    path_edited: null,
    path_derivatives: [],
    ismissing: false,
    albums: [],
    persons: [],
    favorite: false,
    width: 32,
    height: 32,
    ismovie: true,
  });

  const burstIds = [
    'DDDDDDDD-0000-0000-0000-000000000004',
    'EEEEEEEE-0000-0000-0000-000000000005',
    'FFFFFFFF-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000007',
    '22222222-0000-0000-0000-000000000008',
  ];
  burstIds.forEach((uuid, i) => {
    const burstPath = join(library, 'originals', 'C', `IMG_000${i + 4}.png`);
    mkdirSync(join(burstPath, '..'), { recursive: true });
    writeFileSync(burstPath, PIXEL_PNG);
    items.push({
      uuid,
      date: `2025-11-01T10:${(31 + i).toString().padStart(2, '0')}:00+08:00`,
      original_filename: `IMG_000${i + 4}.png`,
      path: burstPath,
      path_edited: null,
      path_derivatives: [],
      ismissing: false,
      albums: [],
      persons: [],
      favorite: false,
      width: 1,
      height: 1,
    });
  });

  mkdirSync(join(root, 'photos'), { recursive: true });
  writeFileSync(
    join(root, 'photos', 'index.json'),
    JSON.stringify(items, null, 2),
  );
  return { original, derivative };
}
