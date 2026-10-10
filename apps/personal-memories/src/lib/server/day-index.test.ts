import { describe, expect, it, vi } from 'vitest';

import { markerViewsFor } from './day-index.ts';
import {
  NO_MARKERS,
  parseMarkerFile,
  resolveMarkers,
} from './markers-store.ts';
import { parsePeople } from './people-store.ts';

const PEOPLE = parsePeople({
  owner: 'bob',
  people: [
    { id: 'bob', name: 'Bob' },
    { id: 'alice', name: 'Alice' },
  ],
});

const MISSING = { status: 'missing', path: undefined } as const;

describe('markerViewsFor', () => {
  it('never reads people when there are no markers', async () => {
    const people = vi.fn(async () => {
      throw new Error('people.json is unreadable');
    });
    expect(await markerViewsFor(NO_MARKERS, people, MISSING)).toEqual(
      new Map(),
    );
    expect(people).not.toHaveBeenCalled();
  });

  it('names the people behind each marker', async () => {
    const markers = resolveMarkers(
      parseMarkerFile({
        markers: [
          {
            date: '2025-11-04',
            person: 'alice',
            kind: 'leave',
            part: 'full',
            event: 'e1',
          },
        ],
      }),
      PEOPLE,
    );
    const views = await markerViewsFor(markers, async () => PEOPLE, MISSING);
    expect(views.get('2025-11-04')?.map((v) => v.name)).toEqual(['Alice']);
  });
});
