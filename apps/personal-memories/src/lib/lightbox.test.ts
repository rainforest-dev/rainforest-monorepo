import { describe, expect, it } from 'vitest';

import {
  coverControl,
  itemFromDataset,
  type LightboxItem,
  positionLabel,
  stepIndex,
  swipeDelta,
} from './lightbox.ts';

const item: LightboxItem = {
  id: 'P1',
  at: '2025-11-01T10:00:00+08:00',
  alt: '',
  video: false,
};

describe('itemFromDataset', () => {
  it('reads a tile dataset and rejects one without id or time', () => {
    expect(
      itemFromDataset({
        eventId: 'P1',
        at: item.at,
        excerpt: '照片',
        width: '4032',
        height: 'x',
        video: '',
      }),
    ).toEqual({
      id: 'P1',
      at: item.at,
      alt: '照片',
      width: 4032,
      height: undefined,
      video: true,
    });
    expect(itemFromDataset({ at: item.at })).toBeUndefined();
    expect(itemFromDataset({ eventId: 'P1' })).toBeUndefined();
  });
});

describe('stepIndex', () => {
  it('clamps at both ends and reaches the end of a large burst', () => {
    expect(stepIndex(0, 7, -1)).toBe(0);
    expect(stepIndex(6, 7, 1)).toBe(6);
    expect(stepIndex(3, 7, 1)).toBe(4);
    let i = 3;
    for (let n = 0; n < 400; n++) i = stepIndex(i, 300, 1);
    expect(i).toBe(299);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe('swipeDelta', () => {
  it('turns a horizontal swipe into a step and ignores short or vertical drags', () => {
    expect(swipeDelta(-80, 5)).toBe(1);
    expect(swipeDelta(80, -5)).toBe(-1);
    expect(swipeDelta(30, 0)).toBe(0);
    expect(swipeDelta(60, 70)).toBe(0);
  });
});

describe('positionLabel', () => {
  it('counts from one', () => {
    expect(positionLabel(3, 7)).toBe('照片 · 4 / 7');
  });
});

describe('coverControl', () => {
  const base = {
    writable: true,
    loaded: true,
    item,
    cover: undefined,
    coverOnDay: false,
    autoCover: 'P9',
  };

  it('hides for read-only notes and videos, and waits for the day to load', () => {
    expect(coverControl({ ...base, writable: false })).toBe('hidden');
    expect(coverControl({ ...base, item: { ...item, video: true } })).toBe(
      'hidden',
    );
    expect(coverControl({ ...base, loaded: false })).toBe('loading');
  });

  it('tells the manual cover, the automatic one and any other photo apart', () => {
    expect(coverControl({ ...base, cover: 'P1', coverOnDay: true })).toBe(
      'manual',
    );
    expect(coverControl({ ...base, autoCover: 'P1' })).toBe('auto');
    expect(
      coverControl({ ...base, cover: 'P5', coverOnDay: true, autoCover: 'P1' }),
    ).toBe('other');
    expect(coverControl(base)).toBe('other');
  });

  it('treats the automatic cover as current when the manual one left the day', () => {
    expect(
      coverControl({
        ...base,
        cover: 'gone',
        coverOnDay: false,
        autoCover: 'P1',
      }),
    ).toBe('auto');
  });
});
