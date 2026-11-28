import { describe, expect, it } from 'vitest';

import {
  applyPatch,
  EMPTY_HALF,
  emptyOrbs,
  isCore,
  orbHalves,
  parseOrbKey,
  printListCsv,
  tallyOrbs,
} from './orbs.ts';

const NOW = '2026-11-14T00:00:00.000Z';
const PAIR = ['a', 'b'];

describe('parseOrbKey', () => {
  it('reads day and photo keys and rejects anything else', () => {
    expect(parseOrbKey('day:2026-03-01')).toEqual({
      kind: 'day',
      date: '2026-03-01',
    });
    expect(parseOrbKey('photo:abc-123')).toEqual({
      kind: 'photo',
      eventId: 'abc-123',
    });
    expect(parseOrbKey('day:2026-3-1')).toBeUndefined();
    expect(parseOrbKey('photo:../x y')).toBeUndefined();
    expect(parseOrbKey('cover:1')).toBeUndefined();
  });
});

describe('applyPatch', () => {
  it('keeps each person on their own pick and drops empty ones', () => {
    let file = applyPatch(
      emptyOrbs(),
      'day:2026-01-02',
      'a',
      { emotion: 'joy' },
      NOW,
    );
    file = applyPatch(
      file,
      'day:2026-01-02',
      'b',
      { island: 'home', core: true },
      NOW,
    );
    expect(file.orbs['day:2026-01-02']).toEqual({
      a: { emotion: 'joy', at: NOW },
      b: { island: 'home', core: true, at: NOW },
    });
    file = applyPatch(file, 'day:2026-01-02', 'a', { emotion: null }, NOW);
    expect(file.orbs['day:2026-01-02']).toEqual({
      b: { island: 'home', core: true, at: NOW },
    });
    file = applyPatch(
      file,
      'day:2026-01-02',
      'b',
      { island: null, core: false },
      NOW,
    );
    expect(file.orbs).toEqual({});
  });
});

describe('isCore', () => {
  it('counts only when both people starred it', () => {
    expect(isCore({ a: { core: true, at: NOW } }, PAIR)).toBe(false);
    expect(
      isCore({ a: { core: true, at: NOW }, b: { core: true, at: NOW } }, PAIR),
    ).toBe(true);
    expect(isCore(undefined, PAIR)).toBe(false);
    expect(isCore({ a: { core: true, at: NOW } }, [])).toBe(false);
  });
});

describe('orbHalves', () => {
  it('colours each half by its person and greys an unpicked half', () => {
    expect(orbHalves({ b: { emotion: 'sad', at: NOW } }, PAIR)).toEqual([
      EMPTY_HALF,
      'var(--io-sad)',
    ]);
    expect(orbHalves(undefined, PAIR)).toEqual([EMPTY_HALF, EMPTY_HALF]);
  });
});

describe('tallyOrbs', () => {
  it('counts an orb once per emotion and island either person chose', () => {
    const tally = tallyOrbs(
      [
        {
          a: { emotion: 'joy', island: 'home', at: NOW },
          b: { emotion: 'joy', at: NOW },
        },
        { b: { emotion: 'fear', island: 'travel', at: NOW } },
        undefined,
      ],
      PAIR,
    );
    expect(tally.emotions.joy).toBe(1);
    expect(tally.emotions.fear).toBe(1);
    expect(tally.islands.home).toBe(1);
    expect(tally.islands.travel).toBe(1);
    expect(tally.emotions.sad).toBe(0);
  });
});

describe('printListCsv', () => {
  it('quotes paths with commas or quotes', () => {
    expect(
      printListCsv([
        { date: '2026-01-01', kind: 'day', path: '/p/a.jpg' },
        { date: '2026-01-02', kind: 'photo', path: '/p/b, "c".jpg' },
      ]),
    ).toBe(
      'date,kind,path\r\n2026-01-01,day,/p/a.jpg\r\n2026-01-02,photo,"/p/b, ""c"".jpg"\r\n',
    );
  });
});
