import { describe, expect, it } from 'vitest';

import { hintsFor, type KeyInput, resolveShortcut } from './keyboard';

const base: KeyInput = {
  key: '',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  typing: false,
  inOverlay: false,
  paneOpen: false,
  hasSelection: false,
  page: 2,
  pageCount: 3,
};
const press = (key: string, extra: Partial<KeyInput> = {}) =>
  resolveShortcut({ ...base, key, ...extra });

describe('resolveShortcut', () => {
  it('maps the global keys', () => {
    expect(press('/')).toEqual({ type: 'focus-search' });
    expect(press('v')).toEqual({ type: 'next-view' });
    expect(press('[')).toEqual({ type: 'go-to-page', page: 1 });
    expect(press(']')).toEqual({ type: 'go-to-page', page: 3 });
  });

  it('does nothing on the first and last page', () => {
    expect(press('[', { page: 1 })).toBeNull();
    expect(press(']', { page: 3 })).toBeNull();
    expect(press(']', { page: 1, pageCount: 1 })).toBeNull();
  });

  it('closes the pane, else clears the selection, else nothing', () => {
    expect(press('Escape', { paneOpen: true, hasSelection: true })).toEqual({
      type: 'close-pane',
    });
    expect(press('Escape', { hasSelection: true })).toEqual({
      type: 'clear-selection',
    });
    expect(press('Escape')).toBeNull();
  });

  it('ignores keys while typing, inside a dialog or menu, and with modifiers', () => {
    expect(press('/', { typing: true })).toBeNull();
    expect(press('Escape', { typing: true, paneOpen: true })).toBeNull();
    expect(press('v', { inOverlay: true })).toBeNull();
    expect(press(']', { altKey: true })).toBeNull();
    expect(press(']', { ctrlKey: true })).toBeNull();
    expect(press('v', { metaKey: true })).toBeNull();
  });

  it('leaves other keys, PageUp and PageDown included, to the browser', () => {
    expect(press('PageDown')).toBeNull();
    expect(press('PageUp')).toBeNull();
    expect(press('V')).toBeNull();
  });
});

describe('hintsFor', () => {
  const labels = (view: Parameters<typeof hintsFor>[0], paged: boolean) =>
    hintsFor(view, paged).map((h) => h.label);

  it('lists the Shelf hints, with Page only when there is more than one page', () => {
    expect(labels('shelf', true)).toEqual([
      'Search',
      'Switch view',
      'Move',
      'Row ends',
      'Page',
      'Open',
      'Select',
      'Close, then clear',
    ]);
    expect(labels('shelf', false)).not.toContain('Page');
  });

  it('lists the Catalogue hints with Space to select', () => {
    expect(labels('catalogue', true)).toEqual([
      'Search',
      'Switch view',
      'Move',
      'Page',
      'Select',
      'Open',
      'Close, then clear',
    ]);
    expect(
      hintsFor('catalogue', true).find((h) => h.label === 'Select')?.keys,
    ).toEqual(['Space']);
  });

  it('keeps the Study hints ready for phase 2', () => {
    expect(labels('study', true)).toEqual([
      'Search',
      'Switch view',
      'Along shelf',
      'Between shelves',
      'Shelf ends',
      'Page',
      'Open',
      'Select',
      'Close, then clear',
    ]);
  });
});
