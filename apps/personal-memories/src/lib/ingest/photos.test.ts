import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { writePhotoFixture } from './__fixtures__/photos.ts';
import { parsePhotoIndex } from './photos.ts';

const root = mkdtempSync(join(tmpdir(), 'memories-photos-'));
const { original, derivative } = writePhotoFixture(root);
const result = parsePhotoIndex(
  JSON.parse(readFileSync(join(root, 'photos', 'index.json'), 'utf8')),
);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('parsePhotoIndex', () => {
  it('keeps items with local media and counts the rest', () => {
    expect(result.events).toHaveLength(2);
    expect(result.skippedNoMedia).toBe(1);
    expect(result.skippedInvalid).toBe(0);
  });

  it('uses the uuid as id and normalises dates to +08:00', () => {
    expect(result.events.map((e) => [e.id, e.at])).toEqual([
      ['AAAAAAAA-0000-0000-0000-000000000001', '2025-11-01T10:15:00+08:00'],
      ['BBBBBBBB-0000-0000-0000-000000000002', '2025-11-01T10:30:00+08:00'],
    ]);
  });

  it('points at the original in place, or the derivative when cloud-only', () => {
    expect(result.events[0].media).toEqual([{ path: original }]);
    expect(result.events[1].media).toEqual([{ path: derivative }]);
  });

  it('uses albums as text and "photo" as author', () => {
    expect(result.events[0].text).toBe('Weekend, Food');
    expect(result.events[1].text).toBeUndefined();
    expect(
      result.events.every((e) => e.author === 'photo' && e.source === 'photo'),
    ).toBe(true);
  });

  it('prefers the edited version over the original', () => {
    const { events } = parsePhotoIndex([
      {
        uuid: 'X',
        date: '2025-11-01T00:00:00+08:00',
        path: '/o.jpg',
        path_edited: '/e.jpg',
      },
    ]);
    expect(events[0].media).toEqual([{ path: '/e.jpg' }]);
  });
});
