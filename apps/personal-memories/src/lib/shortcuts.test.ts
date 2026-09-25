import { describe, expect, it } from 'vitest';

import type { Place } from './nav.ts';
import { type KeyInput, resolveShortcut } from './shortcuts.ts';

const DAY: Place = { level: 'day', date: '2025-11-02' };
const key = (k: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  modified: false,
  typing: false,
  overlayOpen: false,
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

  it('keeps day keys on the day and cell keys on a focused heat cell', () => {
    expect(resolveShortcut(key('j'))).toEqual({ type: 'step-day', delta: 1 });
    expect(resolveShortcut(key('k'))).toEqual({ type: 'step-day', delta: -1 });
    expect(resolveShortcut(key('n'))).toEqual({ type: 'focus-note' });
    expect(
      resolveShortcut(key('j', { place: { level: 'year' } })),
    ).toBeUndefined();
    const year = { place: { level: 'year' } as Place };
    expect(
      resolveShortcut(key('ArrowRight', { ...year, onCell: true })),
    ).toEqual({ type: 'step-cell', delta: 1 });
    expect(
      resolveShortcut(key('ArrowLeft', { ...year, onCell: true })),
    ).toEqual({ type: 'step-cell', delta: -1 });
    expect(resolveShortcut(key('ArrowRight', year))).toBeUndefined();
  });
});
