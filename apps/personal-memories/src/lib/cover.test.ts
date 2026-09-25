import { describe, expect, it } from 'vitest';

import { pickCover, scoreCover, toggleCover } from './cover.ts';
import type { PhotoSignals, TimelineEvent } from './timeline.ts';

const SIGNALS: PhotoSignals = {
  favorite: false,
  people: 0,
  screenshot: false,
  movie: false,
  burstPick: true,
};

const photo = (
  id: string,
  signals: Partial<PhotoSignals> = {},
  at = '2025-11-01T10:00:00+08:00',
): TimelineEvent => ({
  id,
  source: 'photo',
  at,
  author: 'photo',
  media: [{ path: `/lib/${id}.jpg` }],
  photo: { ...SIGNALS, ...signals },
});

describe('pickCover', () => {
  it('prefers a favourite over a higher score', () => {
    const events = [
      photo('hi', { score: 0.95 }),
      photo('fav', { favorite: true, score: 0.3 }),
    ];
    expect(pickCover(events)).toEqual({ id: 'fav', manual: false });
  });

  it('ranks by score, with a bonus for people and penalties for screenshots and unpicked burst frames', () => {
    expect(
      pickCover([photo('a', { score: 0.5 }), photo('b', { score: 0.7 })])?.id,
    ).toBe('b');
    expect(
      pickCover([
        photo('shot', { score: 0.9, screenshot: true }),
        photo('plain', { score: 0.5 }),
      ])?.id,
    ).toBe('plain');
    expect(
      pickCover([
        photo('frame', { score: 0.8, burstPick: false }),
        photo('pick', { score: 0.5 }),
      ])?.id,
    ).toBe('pick');
    expect(
      pickCover([
        photo('solo', { score: 0.6 }),
        photo('us', { score: 0.5, people: 2 }),
      ])?.id,
    ).toBe('us');
  });

  it('never picks a movie, and a day of only movies has no cover', () => {
    expect(
      pickCover([
        photo('mov', { movie: true, favorite: true }),
        photo('still', { score: 0.1 }),
      ])?.id,
    ).toBe('still');
    expect(pickCover([photo('mov', { movie: true })])).toBeUndefined();
  });

  it('uses the manual cover when that photo is on the day', () => {
    const events = [photo('fav', { favorite: true }), photo('mine')];
    expect(pickCover(events, 'mine')).toEqual({ id: 'mine', manual: true });
  });

  it('ignores a manual cover that is no longer on the day', () => {
    const events = [photo('fav', { favorite: true }), photo('other')];
    expect(pickCover(events, 'gone')).toEqual({ id: 'fav', manual: false });
  });

  it('skips messages and media-less photos, and breaks ties by order', () => {
    const text: TimelineEvent = {
      id: 't',
      source: 'line',
      at: '2025-11-01T09:00:00+08:00',
      author: 'Alice',
      text: 'hi',
    };
    const bare: TimelineEvent = { ...photo('bare'), media: undefined };
    expect(pickCover([text, bare])).toBeUndefined();
    expect(pickCover([photo('first'), photo('second')])?.id).toBe('first');
    expect(pickCover([])).toBeUndefined();
  });

  it('treats missing signals as an average photo', () => {
    expect(scoreCover(undefined)).toBe(0.5);
  });
});

describe('toggleCover', () => {
  it('sets a new cover and clears the current one', () => {
    expect(toggleCover(undefined, 'a')).toBe('a');
    expect(toggleCover('b', 'a')).toBe('a');
    expect(toggleCover('a', 'a')).toBeUndefined();
  });
});
