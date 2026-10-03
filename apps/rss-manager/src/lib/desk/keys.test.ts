import { describe, expect, it } from 'vitest';

import type { Source, StaleType, Topic } from '@/lib/registry.types';

import {
  DESK_HINTS,
  deskHints,
  type DeskKeyInput,
  resolveDeskKey,
  type RowKeyState,
  type ViewKeyState,
} from './keys.js';

const SOURCES: ViewKeyState = {
  paneOpen: false,
  hasSelection: false,
  selectMode: false,
  page: 2,
  pageCount: 3,
  writable: true,
};

function rowOf(
  status: Source['status'],
  stale?: StaleType,
  pending = false,
): RowKeyState {
  return {
    source: { status, stale: stale ? { type: stale, note: '' } : undefined },
    pending,
  };
}

const ACTIVE = rowOf('active');
const PROPOSED = rowOf('proposed');

function resolve(key: string, input: Partial<DeskKeyInput> = {}) {
  return resolveDeskKey({
    key,
    modified: false,
    typing: false,
    inOverlay: false,
    view: SOURCES,
    row: null,
    ...input,
  });
}

const onRow = (
  key: string,
  row: RowKeyState = PROPOSED,
  sources: Partial<ViewKeyState> = {},
) => resolve(key, { row, view: { ...SOURCES, ...sources } });

describe('row keys', () => {
  it.each(['ArrowUp', 'ArrowDown', 'Home', 'End'] as const)(
    '%s moves between rows',
    (key) => {
      expect(onRow(key)).toEqual({ type: 'move', key });
    },
  );

  it('← and → step a page and stop at the ends', () => {
    expect(onRow('ArrowLeft')).toEqual({ type: 'page', page: 1 });
    expect(onRow('ArrowRight')).toEqual({ type: 'page', page: 3 });
    expect(onRow('ArrowLeft', PROPOSED, { page: 1 })).toBeNull();
    expect(onRow('ArrowRight', PROPOSED, { page: 3 })).toBeNull();
    expect(onRow('ArrowRight', PROPOSED, { page: 1, pageCount: 1 })).toBeNull();
  });

  it('Enter opens the pane', () => {
    expect(onRow('Enter')).toEqual({ type: 'open' });
  });

  it.each(['x', ' '])('%j toggles the selection, read-only included', (key) => {
    expect(onRow(key)).toEqual({ type: 'toggle' });
    expect(onRow(key, PROPOSED, { writable: false })).toEqual({
      type: 'toggle',
    });
  });

  it('a activates only where Activate applies', () => {
    expect(onRow('a', PROPOSED)).toEqual({ type: 'activate' });
    expect(onRow('a', rowOf('retired'))).toEqual({ type: 'activate' });
    expect(onRow('a', ACTIVE)).toBeNull();
    expect(onRow('a', rowOf('no-rss'))).toBeNull();
  });

  it('r retires only where Retire applies', () => {
    expect(onRow('r', PROPOSED)).toEqual({ type: 'retire' });
    expect(onRow('r', ACTIVE)).toEqual({ type: 'retire' });
    expect(onRow('r', rowOf('no-rss'))).toEqual({ type: 'retire' });
    expect(onRow('r', rowOf('active', 'feed-dead'))).toEqual({
      type: 'retire',
    });
    expect(onRow('r', rowOf('retired'))).toBeNull();
    expect(onRow('r', rowOf('retired', 'delivery-gap'))).toBeNull();
  });

  it('r re-subscribes an active delivery-gap source instead of retiring it', () => {
    expect(onRow('r', rowOf('active', 'delivery-gap'))).toEqual({
      type: 'resubscribe',
    });
  });

  it('a and r do nothing while the vault is read-only, except re-subscribe', () => {
    const readOnly = { writable: false };
    expect(onRow('a', PROPOSED, readOnly)).toBeNull();
    expect(onRow('r', PROPOSED, readOnly)).toBeNull();
    expect(onRow('r', rowOf('active', 'delivery-gap'), readOnly)).toEqual({
      type: 'resubscribe',
    });
  });

  it('a and r do nothing on a row with a write in flight', () => {
    expect(onRow('a', rowOf('proposed', undefined, true))).toBeNull();
    expect(onRow('r', rowOf('proposed', undefined, true))).toBeNull();
    expect(onRow('r', rowOf('active', 'delivery-gap', true))).toEqual({
      type: 'resubscribe',
    });
  });

  it('capital letters are not row keys', () => {
    expect(onRow('A')).toBeNull();
    expect(onRow('R')).toBeNull();
    expect(onRow('X')).toBeNull();
  });

  it('global keys still work on a row', () => {
    expect(onRow('/')).toEqual({ type: 'focus-search' });
    expect(onRow('2')).toEqual({ type: 'tab', tab: 'topics' });
    expect(onRow(']')).toEqual({ type: 'page', page: 3 });
    expect(onRow('Escape', PROPOSED, { paneOpen: true })).toEqual({
      type: 'close-pane',
    });
  });

  it('row keys need a row', () => {
    for (const key of ['ArrowDown', 'Enter', 'x', ' ', 'a', 'r', 'ArrowLeft'])
      expect(resolve(key)).toBeNull();
  });
});

const TOPICS: ViewKeyState = {
  paneOpen: false,
  hasSelection: false,
  selectMode: false,
  page: 1,
  pageCount: 1,
  writable: true,
};

const topicRow = (status: Topic['status'], pending = false): RowKeyState => ({
  topic: { status },
  pending,
});

const onTopic = (
  key: string,
  row: RowKeyState,
  view: Partial<ViewKeyState> = {},
) => resolve(key, { row, view: { ...TOPICS, ...view } });

describe('topic row keys', () => {
  it('arrows, Home and End move; ← and → have no page to go to', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End'] as const)
      expect(onTopic(key, topicRow('active'))).toEqual({ type: 'move', key });
    expect(onTopic('ArrowLeft', topicRow('active'))).toBeNull();
    expect(onTopic('ArrowRight', topicRow('active'))).toBeNull();
  });

  it.each(['x', ' '])('%j toggles the selection', (key) => {
    expect(onTopic(key, topicRow('declined'))).toEqual({ type: 'toggle' });
  });

  it('a activates proposed and declined topics', () => {
    expect(onTopic('a', topicRow('proposed'))).toEqual({ type: 'activate' });
    expect(onTopic('a', topicRow('declined'))).toEqual({ type: 'activate' });
    expect(onTopic('a', topicRow('active'))).toBeNull();
  });

  it('d declines proposed topics only', () => {
    expect(onTopic('d', topicRow('proposed'))).toEqual({ type: 'decline' });
    expect(onTopic('d', topicRow('active'))).toBeNull();
    expect(onTopic('d', topicRow('declined'))).toBeNull();
  });

  it('a and d write nothing read-only or while the row is pending', () => {
    for (const key of ['a', 'd']) {
      expect(
        onTopic(key, topicRow('proposed'), { writable: false }),
      ).toBeNull();
      expect(onTopic(key, topicRow('proposed', true))).toBeNull();
    }
  });

  it('Enter and r do nothing on a topic, and d nothing on a source', () => {
    expect(onTopic('Enter', topicRow('proposed'))).toBeNull();
    expect(onTopic('r', topicRow('active'))).toBeNull();
    expect(onRow('d', PROPOSED)).toBeNull();
  });

  it('global keys still work on a topic row', () => {
    expect(onTopic('/', topicRow('active'))).toEqual({ type: 'focus-search' });
    expect(onTopic('1', topicRow('active'))).toEqual({
      type: 'tab',
      tab: 'sources',
    });
    expect(onTopic(']', topicRow('active'))).toBeNull();
  });

  it('Esc clears the selection, then leaves select mode', () => {
    const row = topicRow('active');
    expect(
      onTopic('Escape', row, { hasSelection: true, selectMode: true }),
    ).toEqual({ type: 'clear-selection' });
    expect(onTopic('Escape', row, { selectMode: true })).toEqual({
      type: 'leave-select-mode',
    });
    expect(onTopic('Escape', row)).toBeNull();
  });
});

describe('global keys', () => {
  it('/ focuses the search on every tab', () => {
    expect(resolve('/')).toEqual({ type: 'focus-search' });
    expect(resolve('/', { view: null })).toEqual({ type: 'focus-search' });
  });

  it('1 to 3 switch tabs from any tab', () => {
    expect(resolve('1', { view: null })).toEqual({
      type: 'tab',
      tab: 'sources',
    });
    expect(resolve('2')).toEqual({ type: 'tab', tab: 'topics' });
    expect(resolve('3')).toEqual({ type: 'tab', tab: 'queue' });
    expect(resolve('4')).toBeNull();
  });

  it('[ and ] step pages on Sources and stop at the ends', () => {
    expect(resolve('[')).toEqual({ type: 'page', page: 1 });
    expect(resolve(']')).toEqual({ type: 'page', page: 3 });
    expect(resolve('[', { view: { ...SOURCES, page: 1 } })).toBeNull();
    expect(resolve(']', { view: { ...SOURCES, page: 3 } })).toBeNull();
    expect(resolve(']', { view: null })).toBeNull();
  });

  it('Esc closes the pane, then clears the selection, then leaves select mode', () => {
    const all = {
      ...SOURCES,
      paneOpen: true,
      hasSelection: true,
      selectMode: true,
    };
    expect(resolve('Escape', { view: all })).toEqual({
      type: 'close-pane',
    });
    expect(resolve('Escape', { view: { ...all, paneOpen: false } })).toEqual({
      type: 'clear-selection',
    });
    expect(
      resolve('Escape', {
        view: { ...all, paneOpen: false, hasSelection: false },
      }),
    ).toEqual({ type: 'leave-select-mode' });
    expect(resolve('Escape')).toBeNull();
    expect(resolve('Escape', { view: null })).toBeNull();
  });

  it('other keys do nothing', () => {
    for (const key of ['v', 'Tab', 'Enter', 'a', 'ArrowDown'])
      expect(resolve(key)).toBeNull();
  });
});

describe('guards', () => {
  const keys = ['/', '1', ']', 'Escape', 'ArrowDown', 'Enter', 'x', 'a', 'r'];

  it.each([
    ['typing', { typing: true }],
    ['in an overlay', { inOverlay: true }],
    ['with a modifier', { modified: true }],
  ] as const)('every key is skipped %s', (_label, guard) => {
    for (const key of keys)
      expect(
        resolve(key, {
          ...guard,
          row: PROPOSED,
          view: { ...SOURCES, paneOpen: true },
        }),
      ).toBeNull();
  });
});

describe('key hints', () => {
  it('Sources lists the spec keys, with the page hint only when paged', () => {
    expect(deskHints('sources', true).map((h) => h.label)).toEqual([
      'Search',
      'Move',
      'Page',
      'Details',
      'Select',
      'Activate',
      'Retire',
      'Close, then clear',
    ]);
    expect(deskHints('sources', false).map((h) => h.label)).not.toContain(
      'Page',
    );
  });

  it('Topics lists its row keys and the tab keys; Queue only the tab keys', () => {
    expect(deskHints('topics', false).map((h) => h.label)).toEqual([
      'Search',
      'Move',
      'Select',
      'Activate',
      'Decline',
      'Clear selection',
      'Switch tab',
    ]);
    expect(deskHints('queue', true)).toEqual([
      { keys: ['1', '2', '3'], label: 'Switch tab' },
    ]);
    expect(DESK_HINTS.topics.at(-1)).toBe(DESK_HINTS.queue[0]);
  });

  it('hints carry no flags into the row', () => {
    for (const hint of deskHints('sources', true))
      expect(Object.keys(hint).sort()).toEqual(['keys', 'label']);
  });
});
