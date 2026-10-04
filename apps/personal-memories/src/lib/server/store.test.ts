import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { contentType, loadTimeline, mediaFile } from './store.ts';
import { makeEvent } from './timeline.ts';

const root = mkdtempSync(join(tmpdir(), 'memories-store-'));
writeFileSync(
  join(root, 'timeline.json'),
  JSON.stringify({
    generatedAt: '2025-11-03T00:00:00+08:00',
    events: [
      makeEvent({
        id: 'P1',
        source: 'photo',
        at: '2025-11-01T10:00:00+08:00',
        author: 'photo',
        media: [{ path: '/Library/Photos/IMG_1.jpeg' }],
      }),
      makeEvent({
        id: 'S1',
        source: 'slack',
        at: '2025-11-01T11:00:00+08:00',
        author: 'Alice',
        media: [{ path: 'dm-alice/a.png' }, { path: 'dm-alice/b.png' }],
      }),
      makeEvent({
        id: 'L1',
        source: 'line',
        at: '2025-11-01T12:00:00+08:00',
        author: 'Bob',
        text: 'hi',
      }),
    ],
  }),
);

describe('loadTimeline', () => {
  it('reports a missing file instead of throwing', () => {
    expect(loadTimeline(join(root, 'absent')).status).toBe('missing');
    expect(loadTimeline(undefined).status).toBe('missing');
  });
});

describe('mediaFile', () => {
  const state = loadTimeline(root);

  it('resolves photo paths as-is and Slack paths under the export', () => {
    expect(mediaFile(state, root, 'P1')).toBe('/Library/Photos/IMG_1.jpeg');
    expect(mediaFile(state, root, 'S1', 1)).toBe(
      join(root, 'slack', 'dm-alice/b.png'),
    );
  });

  it('only resolves ids and indexes present in the timeline', () => {
    expect(mediaFile(state, root, 'nope')).toBeUndefined();
    expect(mediaFile(state, root, 'L1')).toBeUndefined();
    expect(mediaFile(state, root, 'S1', 2)).toBeUndefined();
    expect(mediaFile(state, root, '../timeline.json')).toBeUndefined();
  });

  it('maps extensions to content types', () => {
    expect(contentType('/x/IMG.JPEG')).toBe('image/jpeg');
    expect(contentType('/x/a.heic')).toBe('image/heic');
    expect(contentType('/x/a.bin')).toBe('application/octet-stream');
  });
});

describe('getTimeline', () => {
  it('picks up a rewritten timeline.json and keeps the old one when the new one has no events', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'memories-store-reload-'));
    const file = join(dir, 'timeline.json');
    const write = (body: unknown, second: number) => {
      writeFileSync(file, JSON.stringify(body));
      const at = new Date(Date.UTC(2025, 10, 1, 0, 0, second));
      utimesSync(file, at, at);
    };
    const event = (id: string) =>
      makeEvent({
        id,
        source: 'line',
        at: '2025-11-01T12:00:00+08:00',
        author: 'Bob',
        text: id,
      });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      vi.stubEnv('MEMORIES_DATA_DIR', dir);
      vi.resetModules();
      const { getTimeline } = await import('./store.ts');
      expect((await getTimeline()).status).toBe('missing');

      write({ generatedAt: 'a', events: [event('L1')] }, 1);
      vi.advanceTimersByTime(5000);
      const first = await getTimeline();
      expect(first.status === 'ready' && [...first.byId.keys()]).toEqual([
        'L1',
      ]);

      write({ generatedAt: 'b' }, 2);
      vi.advanceTimersByTime(5000);
      expect(await getTimeline()).toBe(first);

      write({ generatedAt: 'c', events: [event('L1'), event('L2')] }, 3);
      vi.advanceTimersByTime(5000);
      const next = await getTimeline();
      expect(next.status === 'ready' && next.byId.has('L2')).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });
});
