import { describe, expect, it } from 'vitest';

import { assignRowsByTop, isNavKey, type NavItem, pickTarget } from './roving';

const grid = (cols: number, count: number): NavItem[] =>
  assignRowsByTop(
    Array.from({ length: count }, (_, i) => ({
      key: `all:${i + 1}`,
      row: '',
      order: i,
      rect: {
        x: (i % cols) * 170,
        y: Math.floor(i / cols) * 300,
        width: 148,
        height: 272,
      },
    })),
  );

const noCtrl = { ctrl: false };

describe('isNavKey', () => {
  it('accepts arrows, Home and End only', () => {
    expect(isNavKey('ArrowUp')).toBe(true);
    expect(isNavKey('End')).toBe(true);
    expect(isNavKey('PageDown')).toBe(false);
    expect(isNavKey('x')).toBe(false);
  });
});

describe('pickTarget in a grid', () => {
  const items = grid(3, 7);

  it('derives rows from the item tops', () => {
    expect(items.map((i) => i.row)).toEqual([
      '0',
      '0',
      '0',
      '300',
      '300',
      '300',
      '600',
    ]);
  });

  it('moves left and right in reading order across rows', () => {
    expect(pickTarget(items, 'all:3', 'ArrowRight', noCtrl)).toBe('all:4');
    expect(pickTarget(items, 'all:4', 'ArrowLeft', noCtrl)).toBe('all:3');
  });

  it('stops at the page edges', () => {
    expect(pickTarget(items, 'all:1', 'ArrowLeft', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:7', 'ArrowRight', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:2', 'ArrowUp', noCtrl)).toBeNull();
    expect(pickTarget(items, 'all:7', 'ArrowDown', noCtrl)).toBeNull();
  });

  it('moves up and down to the nearest item by rect', () => {
    expect(pickTarget(items, 'all:2', 'ArrowDown', noCtrl)).toBe('all:5');
    expect(pickTarget(items, 'all:5', 'ArrowUp', noCtrl)).toBe('all:2');
    expect(pickTarget(items, 'all:6', 'ArrowDown', noCtrl)).toBe('all:7');
  });

  it('prefers the next row over a closer column two rows down', () => {
    const items2: NavItem[] = [
      {
        key: 'a',
        row: 'r0',
        order: 0,
        rect: { x: 0, y: 0, width: 148, height: 272 },
      },
      {
        key: 'b',
        row: 'r1',
        order: 1,
        rect: { x: 340, y: 300, width: 148, height: 272 },
      },
      {
        key: 'c',
        row: 'r2',
        order: 2,
        rect: { x: 0, y: 600, width: 148, height: 272 },
      },
    ];
    expect(pickTarget(items2, 'a', 'ArrowDown', noCtrl)).toBe('b');
  });

  it('goes to the ends of the current row with Home and End', () => {
    expect(pickTarget(items, 'all:5', 'Home', noCtrl)).toBe('all:4');
    expect(pickTarget(items, 'all:5', 'End', noCtrl)).toBe('all:6');
  });

  it('goes to the ends of the page with Ctrl+Home and Ctrl+End', () => {
    expect(pickTarget(items, 'all:5', 'Home', { ctrl: true })).toBe('all:1');
    expect(pickTarget(items, 'all:5', 'End', { ctrl: true })).toBe('all:7');
  });

  it('starts from the first item when the current key is gone', () => {
    expect(pickTarget(items, 'all:99', 'ArrowRight', noCtrl)).toBe('all:1');
  });
});

describe('pickTarget over group rows', () => {
  const rows: NavItem[] = [
    {
      key: 'series:1:2',
      row: 'series:1',
      order: 0,
      rect: { x: 0, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:1:3',
      row: 'series:1',
      order: 1,
      rect: { x: 170, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:1:4',
      row: 'series:1',
      order: 2,
      rect: { x: 340, y: 0, width: 148, height: 272 },
    },
    {
      key: 'series:2:9',
      row: 'series:2',
      order: 3,
      rect: { x: 0, y: 360, width: 148, height: 272 },
    },
    {
      key: 'series:2:8',
      row: 'series:2',
      order: 4,
      rect: { x: 170, y: 360, width: 148, height: 272 },
    },
  ];

  it('crosses groups in reading order', () => {
    expect(pickTarget(rows, 'series:1:4', 'ArrowRight', noCtrl)).toBe(
      'series:2:9',
    );
  });

  it('moves down to the nearest book of the next group row', () => {
    expect(pickTarget(rows, 'series:1:4', 'ArrowDown', noCtrl)).toBe(
      'series:2:8',
    );
  });

  it('keeps Home and End inside the group row', () => {
    expect(pickTarget(rows, 'series:2:8', 'Home', noCtrl)).toBe('series:2:9');
    expect(pickTarget(rows, 'series:1:2', 'End', noCtrl)).toBe('series:1:4');
  });

  it('uses the rows the caller gives, as Study will from its layout', () => {
    const overlapping = rows.map((item) => ({
      ...item,
      rect: { ...item.rect, y: 0 },
    }));
    expect(pickTarget(overlapping, 'series:2:8', 'Home', noCtrl)).toBe(
      'series:2:9',
    );
  });
});

describe('pickTarget with one book in two tags', () => {
  const dupes: NavItem[] = [
    {
      key: 'tag:8:39',
      row: 'tag:8',
      order: 0,
      rect: { x: 0, y: 0, width: 148, height: 272 },
    },
    {
      key: 'tag:3:39',
      row: 'tag:3',
      order: 1,
      rect: { x: 0, y: 360, width: 148, height: 272 },
    },
    {
      key: 'tag:3:42',
      row: 'tag:3',
      order: 2,
      rect: { x: 170, y: 360, width: 148, height: 272 },
    },
  ];

  it('treats each copy as its own item', () => {
    expect(pickTarget(dupes, 'tag:8:39', 'ArrowRight', noCtrl)).toBe(
      'tag:3:39',
    );
    expect(pickTarget(dupes, 'tag:3:39', 'ArrowLeft', noCtrl)).toBe('tag:8:39');
    expect(pickTarget(dupes, 'tag:3:39', 'ArrowRight', noCtrl)).toBe(
      'tag:3:42',
    );
  });
});

describe('pickTarget in a list', () => {
  const list: NavItem[] = [
    {
      key: 'series:1:2',
      row: 'series:1',
      order: 0,
      rect: { x: 0, y: 0, width: 800, height: 48 },
    },
    {
      key: 'series:1:3',
      row: 'series:1',
      order: 1,
      rect: { x: 0, y: 48, width: 800, height: 48 },
    },
    {
      key: 'series:2:9',
      row: 'series:2',
      order: 2,
      rect: { x: 0, y: 140, width: 800, height: 48 },
    },
  ];

  it('moves one row with ArrowUp and ArrowDown and ignores left and right', () => {
    expect(pickTarget(list, 'series:1:3', 'ArrowDown', noCtrl, 'list')).toBe(
      'series:2:9',
    );
    expect(pickTarget(list, 'series:1:3', 'ArrowUp', noCtrl, 'list')).toBe(
      'series:1:2',
    );
    expect(
      pickTarget(list, 'series:1:3', 'ArrowRight', noCtrl, 'list'),
    ).toBeNull();
    expect(
      pickTarget(list, 'series:2:9', 'ArrowDown', noCtrl, 'list'),
    ).toBeNull();
  });

  it('keeps Home and End in the current group and Ctrl reaches the page ends', () => {
    expect(pickTarget(list, 'series:1:3', 'Home', noCtrl, 'list')).toBe(
      'series:1:2',
    );
    expect(pickTarget(list, 'series:1:2', 'End', noCtrl, 'list')).toBe(
      'series:1:3',
    );
    expect(pickTarget(list, 'series:1:2', 'End', { ctrl: true }, 'list')).toBe(
      'series:2:9',
    );
  });
});
