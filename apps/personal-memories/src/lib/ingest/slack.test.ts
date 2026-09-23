import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseSlackExport } from './slack.ts';

const root = join(import.meta.dirname, '__fixtures__', 'slack');
const { events, skipped } = parseSlackExport(root);

describe('parseSlackExport', () => {
  it('keeps messages and file shares, skips other subtypes', () => {
    expect(events).toHaveLength(6);
    expect(skipped).toBe(2);
  });

  it('converts ts to +08:00 timestamps in order across day files', () => {
    expect(events.map((e) => e.at)).toEqual([
      '2025-11-01T09:00:00+08:00',
      '2025-11-01T09:05:00+08:00',
      '2025-11-01T09:06:00+08:00',
      '2025-11-02T09:00:00+08:00',
      '2025-11-02T09:01:00+08:00',
      '2025-11-02T09:02:00+08:00',
    ]);
  });

  it('resolves display names, falling back to real names, and mentions', () => {
    expect(events.map((e) => e.author)).toEqual([
      'Bob',
      'Alice',
      'Alice',
      'Bob',
      'Alice',
      'Bob',
    ]);
    expect(events[0].text).toBe('Morning @Alice');
  });

  it('attaches exported files relative to the root', () => {
    expect(events[1].media).toEqual([
      { path: join('dm-alice', 'map.png'), width: 1, height: 1 },
    ]);
    expect(events[1].text).toBe('Here is the map');
  });

  it('names files missing from the export in the text, one line each', () => {
    expect(events[2].media).toBeUndefined();
    expect(events[2].text).toBe('And the missing one\n[file] not-exported.jpg');
    expect(events[5].media).toBeUndefined();
    expect(events[5].text).toBe('[file] receipt.pdf\n[file] ticket.jpg');
  });

  it('treats thread replies as ordinary events', () => {
    expect(events[4].text).toBe('Thread reply');
  });

  it('keeps exported file dimensions', () => {
    const { events } = parseSlackExport(root);
    const map = events.find((e) => e.text === 'Here is the map');
    expect(map?.media).toEqual([
      { path: join('dm-alice', 'map.png'), width: 1, height: 1 },
    ]);
  });
});
