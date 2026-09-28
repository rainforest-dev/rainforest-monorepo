import { describe, expect, it } from 'vitest';

import type { Place } from './nav.ts';
import {
  type KeyInput,
  MONTH_HINTS,
  resolveShortcut,
  SHORTCUT_GROUPS,
  YEAR_HINTS,
} from './shortcuts.ts';

const DAY: Place = { level: 'day', date: '2025-11-02' };
const key = (k: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  modified: false,
  typing: false,
  overlayOpen: false,
  previewOpen: false,
  onCell: false,
  place: DAY,
  ...over,
});

describe('resolveShortcut', () => {
  it('opens the overlays anywhere', () => {
    expect(resolveShortcut(key('?', { place: { level: 'year' } }))).toEqual({
      type: 'open-shortcuts',
    });
    expect(resolveShortcut(key('/'))).toEqual({ type: 'open-jump' });
  });

  it('zooms out one level on Escape, and blurs a heat cell on the year', () => {
    expect(resolveShortcut(key('Escape'))).toEqual({
      type: 'navigate',
      href: '/month/2025-11',
    });
    expect(
      resolveShortcut(
        key('Escape', { place: { level: 'month', month: '2025-11' } }),
      ),
    ).toEqual({ type: 'navigate', href: '/' });
    expect(
      resolveShortcut(key('Escape', { place: { level: 'year' } })),
    ).toBeUndefined();
    expect(
      resolveShortcut(
        key('Escape', { place: { level: 'year' }, onCell: true }),
      ),
    ).toEqual({ type: 'blur' });
  });

  it('never acts while typing, with an overlay open, with a modifier, or off the three levels', () => {
    for (const k of ['Escape', 'j', '/', '?', 'n']) {
      expect(resolveShortcut(key(k, { typing: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { overlayOpen: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { modified: true }))).toBeUndefined();
      expect(resolveShortcut(key(k, { place: undefined }))).toBeUndefined();
    }
  });

  it('keeps day keys on the day', () => {
    expect(resolveShortcut(key('j'))).toEqual({ type: 'step-day', delta: 1 });
    expect(resolveShortcut(key('k'))).toEqual({ type: 'step-day', delta: -1 });
    expect(resolveShortcut(key('n'))).toEqual({ type: 'focus-note' });
    expect(
      resolveShortcut(key('j', { place: { level: 'year' } })),
    ).toBeUndefined();
  });

  it('moves within a grid on the year and the month, only from a focused cell', () => {
    const places: Place[] = [
      { level: 'year' },
      { level: 'month', month: '2025-11' },
    ];
    for (const place of places)
      for (const k of [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ]) {
        expect(resolveShortcut(key(k, { place, onCell: true }))).toEqual({
          type: 'grid',
          key: k,
        });
        expect(resolveShortcut(key(k, { place }))).toBeUndefined();
      }
    expect(resolveShortcut(key('ArrowUp', { onCell: true }))).toBeUndefined();
  });

  it('closes an open preview before Escape does anything else', () => {
    const places: Place[] = [
      { level: 'year' },
      { level: 'month', month: '2025-11' },
    ];
    for (const place of places)
      expect(
        resolveShortcut(
          key('Escape', { place, onCell: true, previewOpen: true }),
        ),
      ).toEqual({ type: 'close-preview' });
    expect(
      resolveShortcut(key('Escape', { previewOpen: true, overlayOpen: true })),
    ).toBeUndefined();
  });
});

describe('key hints and the shortcuts dialog', () => {
  it('hints the arrow keys under each grid', () => {
    expect(YEAR_HINTS).toEqual([
      { keys: ['←', '→'], label: '在日子間移動' },
      { keys: ['↑', '↓'], label: '上下一個月' },
      { keys: ['Enter'], label: '打開那一天' },
    ]);
    expect(MONTH_HINTS).toEqual([
      { keys: ['←', '→'], label: '前後一天' },
      { keys: ['↑', '↓'], label: '前後一週' },
      { keys: ['Enter'], label: '打開那一天' },
    ]);
  });

  it('gives the dialog a month group and the new rows on the year and the month', () => {
    expect(SHORTCUT_GROUPS.map((g) => g.title)).toEqual([
      '全部畫面',
      '年',
      '月',
      '日',
      '照片',
    ]);
    for (const title of ['年', '月']) {
      const rows = SHORTCUT_GROUPS.find((g) => g.title === title)?.rows ?? [];
      expect(rows).toContainEqual({ keys: ['↑', '↓'], label: '上下一行' });
      expect(rows).toContainEqual({
        keys: ['Home', 'End'],
        label: '第一天／最後一天',
      });
      expect(rows).toContainEqual({ keys: ['Enter'], label: '打開那一天' });
    }
    expect(SHORTCUT_GROUPS.find((g) => g.title === '月')?.rows[0]).toEqual({
      keys: ['←', '→'],
      label: '前後一天',
    });
  });
});
