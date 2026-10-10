import { describe, expect, it } from 'vitest';

import {
  dayDetail,
  type DayMarker,
  dominantKind,
  markerBars,
  markerLabel,
  markerSummary,
  markerViews,
  markerViewsByDate,
} from './markers.ts';

const PEOPLE = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];
const OWNERS = new Set(['Bob']);
const POSTED: Record<string, string> = { e1: '2025-11-02' };
const postedOn = (id: string) => POSTED[id];

const marker = (
  person: string,
  kind: DayMarker['kind'],
  part: DayMarker['part'],
  event = 'e1',
): DayMarker => ({ date: '2025-11-03', person, kind, part, event });

describe('markerLabel', () => {
  it('joins kind and part', () => {
    expect(markerLabel({ kind: 'leave', part: 'pm' })).toBe('請假・下午');
    expect(markerLabel({ kind: 'wfh', part: 'full' })).toBe('WFH・全天');
  });
});

describe('markerViews', () => {
  it('names people, puts the owner first and orders a day am before pm', () => {
    const views = markerViews(
      [
        marker('alice', 'wfh', 'pm'),
        marker('alice', 'leave', 'am'),
        marker('bob', 'wfh', 'full'),
      ],
      PEOPLE,
      OWNERS,
      postedOn,
    );
    expect(views.map((v) => [v.name, v.owner, v.part])).toEqual([
      ['Bob', true, 'full'],
      ['Alice', false, 'am'],
      ['Alice', false, 'pm'],
    ]);
    expect(views[0]?.postedOn).toBe('2025-11-02');
  });

  it('leaves postedOn out when the source message is not in the timeline', () => {
    const [view] = markerViews(
      [marker('alice', 'leave', 'full', 'gone')],
      PEOPLE,
      OWNERS,
      postedOn,
    );
    expect(view).not.toHaveProperty('postedOn');
  });

  it('builds views per date', () => {
    const byDate = new Map([['2025-11-03', [marker('alice', 'wfh', 'am')]]]);
    expect(
      markerViewsByDate(byDate, PEOPLE, OWNERS, postedOn).get('2025-11-03'),
    ).toHaveLength(1);
  });
});

describe('bars, summary and detail', () => {
  const views = markerViews(
    [
      marker('alice', 'leave', 'am'),
      marker('alice', 'wfh', 'pm'),
      marker('bob', 'wfh', 'full'),
    ],
    PEOPLE,
    OWNERS,
    postedOn,
  );

  it('groups bars per person in view order', () => {
    expect(markerBars(views)).toEqual([
      { person: 'bob', segments: [{ kind: 'wfh', part: 'full' }] },
      {
        person: 'alice',
        segments: [
          { kind: 'leave', part: 'am' },
          { kind: 'wfh', part: 'pm' },
        ],
      },
    ]);
  });

  it('summarises per person', () => {
    expect(markerSummary(views)).toBe(
      'Bob WFH・全天，Alice 請假・上午、WFH・下午',
    );
    expect(markerSummary([])).toBe('');
  });

  it('prefers leave as the dominant kind', () => {
    expect(dominantKind(views)).toBe('leave');
    expect(dominantKind(views.filter((v) => v.kind === 'wfh'))).toBe('wfh');
    expect(dominantKind([])).toBeUndefined();
  });

  it('extends the day detail only when there are markers', () => {
    expect(dayDetail(3, true)).toBe('3 則 · 已寫回憶');
    expect(dayDetail(0, false, views.slice(0, 1))).toBe('0 則 · Bob WFH・全天');
  });
});
