import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const { touched, recording } = vi.hoisted(() => {
  const touched: string[] = [];
  const recording = <T extends object>(actual: T): T =>
    Object.fromEntries(
      Object.entries(actual).map(([name, value]) => [
        name,
        typeof value === 'function'
          ? (...args: unknown[]) => {
              if (typeof args[0] === 'string') touched.push(args[0]);
              return (value as (...a: unknown[]) => unknown)(...args);
            }
          : value,
      ]),
    ) as T;
  return { touched, recording };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...recording(actual), default: recording(actual) };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...recording(actual), default: recording(actual) };
});

const { loadTimeline, makeEvent } = await import('@/lib/server');
const { dayCells } = await import('./month-view.ts');
const { heatLevels, indexDays, monthRows, summarize } =
  await import('./days.ts');

const LIBRARY = '/nonexistent/Photos Library.photoslibrary';
const root = mkdtempSync(join(tmpdir(), 'memories-year-io-'));
writeFileSync(
  join(root, 'timeline.json'),
  JSON.stringify({
    generatedAt: '2025-11-03T00:00:00+08:00',
    events: Array.from({ length: 40 }, (_, i) =>
      makeEvent({
        id: `P${i}`,
        source: 'photo',
        at: `2025-11-${String((i % 20) + 1).padStart(2, '0')}T10:00:00+08:00`,
        author: 'photo',
        media: [
          { path: `${LIBRARY}/resources/derivatives/P${i}_1_105_c.jpeg` },
        ],
        photo: {
          favorite: i % 7 === 0,
          people: 0,
          screenshot: false,
          movie: false,
          burstPick: true,
        },
      }),
    ),
  }),
);

describe('the year view', () => {
  it('builds every cell and cover without touching a photo file', () => {
    touched.length = 0;
    const state = loadTimeline(root);
    if (state.status !== 'ready') throw new Error('timeline missing');

    const index = indexDays(state.timeline.events);
    const days = summarize(index);
    const totals = new Map(days.map((d) => [d.date, d.total]));
    monthRows(days[0]?.date ?? '', days.at(-1)?.date ?? '', totals);
    heatLevels([...totals.values()]);
    const cells = dayCells(index, new Set(), () => undefined);

    expect([...cells.values()].filter((c) => c.cover)).toHaveLength(20);
    expect(touched).toContain(join(root, 'timeline.json'));
    expect(touched.filter((p) => p.startsWith(LIBRARY))).toEqual([]);
  });
});
