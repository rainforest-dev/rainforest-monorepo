import { describe, expect, it } from 'vitest';

import {
  assignRowsByTop,
  isNavKey,
  type NavItem,
  type NavKey,
  pickTarget,
} from './roving.js';

const pick = (
  items: readonly NavItem[],
  current: string,
  key: NavKey,
  mods: { ctrl: boolean },
  mode: 'grid' | 'list' = 'grid',
) => pickTarget(items, current, key, { mode, homeEnd: 'row', ctrl: mods.ctrl });

describe('calibre', () => {
  const grid = (cols: number, count: number): NavItem[] =>
    assignRowsByTop(
      Array.from({ length: count }, (_, i) => ({
        key: `all:${i + 1}`,
        order: i,
        rect: {
          left: (i % cols) * 170,
          top: Math.floor(i / cols) * 300,
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
      expect(items.map((i) => String(i.row))).toEqual([
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
      expect(pick(items, 'all:3', 'ArrowRight', noCtrl)).toBe('all:4');
      expect(pick(items, 'all:4', 'ArrowLeft', noCtrl)).toBe('all:3');
    });

    it('stops at the page edges', () => {
      expect(pick(items, 'all:1', 'ArrowLeft', noCtrl)).toBeNull();
      expect(pick(items, 'all:7', 'ArrowRight', noCtrl)).toBeNull();
      expect(pick(items, 'all:2', 'ArrowUp', noCtrl)).toBeNull();
      expect(pick(items, 'all:7', 'ArrowDown', noCtrl)).toBeNull();
    });

    it('moves up and down to the nearest item by rect', () => {
      expect(pick(items, 'all:2', 'ArrowDown', noCtrl)).toBe('all:5');
      expect(pick(items, 'all:5', 'ArrowUp', noCtrl)).toBe('all:2');
      expect(pick(items, 'all:6', 'ArrowDown', noCtrl)).toBe('all:7');
    });

    it('prefers the next row over a closer column two rows down', () => {
      const items2: NavItem[] = [
        {
          key: 'a',
          row: 0,
          order: 0,
          rect: { left: 0, top: 0, width: 148, height: 272 },
        },
        {
          key: 'b',
          row: 1,
          order: 1,
          rect: { left: 340, top: 300, width: 148, height: 272 },
        },
        {
          key: 'c',
          row: 2,
          order: 2,
          rect: { left: 0, top: 600, width: 148, height: 272 },
        },
      ];
      expect(pick(items2, 'a', 'ArrowDown', noCtrl)).toBe('b');
    });

    it('goes to the ends of the current row with Home and End', () => {
      expect(pick(items, 'all:5', 'Home', noCtrl)).toBe('all:4');
      expect(pick(items, 'all:5', 'End', noCtrl)).toBe('all:6');
    });

    it('goes to the ends of the page with Ctrl+Home and Ctrl+End', () => {
      expect(pick(items, 'all:5', 'Home', { ctrl: true })).toBe('all:1');
      expect(pick(items, 'all:5', 'End', { ctrl: true })).toBe('all:7');
    });

    it('starts from the first item when the current key is gone', () => {
      expect(pick(items, 'all:99', 'ArrowRight', noCtrl)).toBe('all:1');
    });
  });

  describe('pickTarget over group rows', () => {
    const rows: NavItem[] = [
      {
        key: 'series:1:2',
        row: 0,
        order: 0,
        rect: { left: 0, top: 0, width: 148, height: 272 },
      },
      {
        key: 'series:1:3',
        row: 0,
        order: 1,
        rect: { left: 170, top: 0, width: 148, height: 272 },
      },
      {
        key: 'series:1:4',
        row: 0,
        order: 2,
        rect: { left: 340, top: 0, width: 148, height: 272 },
      },
      {
        key: 'series:2:9',
        row: 1,
        order: 3,
        rect: { left: 0, top: 360, width: 148, height: 272 },
      },
      {
        key: 'series:2:8',
        row: 1,
        order: 4,
        rect: { left: 170, top: 360, width: 148, height: 272 },
      },
    ];

    it('crosses groups in reading order', () => {
      expect(pick(rows, 'series:1:4', 'ArrowRight', noCtrl)).toBe('series:2:9');
    });

    it('moves down to the nearest book of the next group row', () => {
      expect(pick(rows, 'series:1:4', 'ArrowDown', noCtrl)).toBe('series:2:8');
    });

    it('keeps Home and End inside the group row', () => {
      expect(pick(rows, 'series:2:8', 'Home', noCtrl)).toBe('series:2:9');
      expect(pick(rows, 'series:1:2', 'End', noCtrl)).toBe('series:1:4');
    });

    it('uses the rows the caller gives, as Study will from its layout', () => {
      const overlapping = rows.map((item) => ({
        ...item,
        rect: item.rect && { ...item.rect, top: 0 },
      }));
      expect(pick(overlapping, 'series:2:8', 'Home', noCtrl)).toBe(
        'series:2:9',
      );
    });
  });

  describe('pickTarget with one book in two tags', () => {
    const dupes: NavItem[] = [
      {
        key: 'tag:8:39',
        row: 0,
        order: 0,
        rect: { left: 0, top: 0, width: 148, height: 272 },
      },
      {
        key: 'tag:3:39',
        row: 1,
        order: 1,
        rect: { left: 0, top: 360, width: 148, height: 272 },
      },
      {
        key: 'tag:3:42',
        row: 1,
        order: 2,
        rect: { left: 170, top: 360, width: 148, height: 272 },
      },
    ];

    it('treats each copy as its own item', () => {
      expect(pick(dupes, 'tag:8:39', 'ArrowRight', noCtrl)).toBe('tag:3:39');
      expect(pick(dupes, 'tag:3:39', 'ArrowLeft', noCtrl)).toBe('tag:8:39');
      expect(pick(dupes, 'tag:3:39', 'ArrowRight', noCtrl)).toBe('tag:3:42');
    });
  });

  describe('pickTarget in a list', () => {
    const list: NavItem[] = [
      {
        key: 'series:1:2',
        row: 0,
        order: 0,
        rect: { left: 0, top: 0, width: 800, height: 48 },
      },
      {
        key: 'series:1:3',
        row: 0,
        order: 1,
        rect: { left: 0, top: 48, width: 800, height: 48 },
      },
      {
        key: 'series:2:9',
        row: 1,
        order: 2,
        rect: { left: 0, top: 140, width: 800, height: 48 },
      },
    ];

    it('moves one row with ArrowUp and ArrowDown and ignores left and right', () => {
      expect(pick(list, 'series:1:3', 'ArrowDown', noCtrl, 'list')).toBe(
        'series:2:9',
      );
      expect(pick(list, 'series:1:3', 'ArrowUp', noCtrl, 'list')).toBe(
        'series:1:2',
      );
      expect(pick(list, 'series:1:3', 'ArrowRight', noCtrl, 'list')).toBeNull();
      expect(pick(list, 'series:2:9', 'ArrowDown', noCtrl, 'list')).toBeNull();
    });

    it('keeps Home and End in the current group and Ctrl reaches the page ends', () => {
      expect(pick(list, 'series:1:3', 'Home', noCtrl, 'list')).toBe(
        'series:1:2',
      );
      expect(pick(list, 'series:1:2', 'End', noCtrl, 'list')).toBe(
        'series:1:3',
      );
      expect(pick(list, 'series:1:2', 'End', { ctrl: true }, 'list')).toBe(
        'series:2:9',
      );
    });
  });
});

describe('memories', () => {
  type GridLayout = 'year' | 'week' | 'list';
  type Slot = { date: string; row: string; col: number };

  function slotOf(date: string, layout: GridLayout): Slot {
    const month = date.slice(0, 7);
    const day = Number(date.slice(8, 10));
    if (layout === 'list') return { date, row: date, col: 0 };
    if (layout === 'year') return { date, row: month, col: day - 1 };
    const lead = new Date(
      Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1),
    ).getUTCDay();
    const index = lead + day - 1;
    return { date, row: `${month}/${Math.floor(index / 7)}`, col: index % 7 };
  }

  function gridTarget(
    dates: readonly string[],
    current: string,
    key: NavKey,
    layout: GridLayout,
  ): string | undefined {
    const sorted = [...new Set(dates)].sort();
    if (!sorted.includes(current)) return undefined;
    const rows: string[] = [];
    const items = sorted.map((date, order) => {
      const slot = slotOf(date, layout);
      if (rows.at(-1) !== slot.row) rows.push(slot.row);
      return { key: date, row: rows.length - 1, col: slot.col, order };
    });
    return (
      pickTarget(items, current, key, {
        mode: 'grid',
        homeEnd: 'page',
      }) ?? undefined
    );
  }

  const FIXTURE = ['2025-10-31', '2025-11-01', '2025-11-02', '2025-11-03'];

  describe('gridTarget', () => {
    it('steps to the previous and next day with data, and stops at the ends', () => {
      expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowLeft', 'year')).toBe(
        '2025-10-31',
      );
      expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowRight', 'year')).toBe(
        '2025-11-02',
      );
      expect(
        gridTarget(FIXTURE, '2025-10-31', 'ArrowLeft', 'year'),
      ).toBeUndefined();
      expect(
        gridTarget(FIXTURE, '2025-11-03', 'ArrowRight', 'week'),
      ).toBeUndefined();
    });

    it('jumps to the first and last day with data on Home and End', () => {
      expect(gridTarget(FIXTURE, '2025-11-02', 'Home', 'year')).toBe(
        '2025-10-31',
      );
      expect(gridTarget(FIXTURE, '2025-11-02', 'End', 'list')).toBe(
        '2025-11-03',
      );
    });

    it('on the year, takes the same day in the next month row, else the nearest day with data', () => {
      const dates = ['2025-09-10', '2025-10-03', '2025-10-20', '2025-11-03'];
      expect(gridTarget(dates, '2025-10-03', 'ArrowDown', 'year')).toBe(
        '2025-11-03',
      );
      expect(gridTarget(dates, '2025-10-20', 'ArrowUp', 'year')).toBe(
        '2025-09-10',
      );
      expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'year')).toBe(
        '2025-10-03',
      );
      expect(gridTarget(FIXTURE, '2025-11-03', 'ArrowUp', 'year')).toBe(
        '2025-10-31',
      );
      expect(gridTarget(FIXTURE, '2025-10-31', 'ArrowDown', 'year')).toBe(
        '2025-11-03',
      );
    });

    it('breaks a tie between two equally near days toward the earlier one', () => {
      const dates = ['2025-10-08', '2025-10-12', '2025-11-10'];
      expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'year')).toBe(
        '2025-10-08',
      );
    });

    it('keeps going past a month row with no data, and stops past the last row', () => {
      const dates = ['2025-08-05', '2025-11-05'];
      expect(gridTarget(dates, '2025-11-05', 'ArrowUp', 'year')).toBe(
        '2025-08-05',
      );
      expect(
        gridTarget(dates, '2025-08-05', 'ArrowUp', 'year'),
      ).toBeUndefined();
      expect(
        gridTarget(dates, '2025-11-05', 'ArrowDown', 'year'),
      ).toBeUndefined();
    });

    it('on the month calendar (November 2025 starts on a Saturday), moves a week, else the nearest day in that week', () => {
      const dates = ['2025-11-01', '2025-11-02', '2025-11-03', '2025-11-10'];
      expect(gridTarget(dates, '2025-11-03', 'ArrowDown', 'week')).toBe(
        '2025-11-10',
      );
      expect(gridTarget(dates, '2025-11-10', 'ArrowUp', 'week')).toBe(
        '2025-11-03',
      );
      expect(gridTarget(dates, '2025-11-03', 'ArrowUp', 'week')).toBe(
        '2025-11-01',
      );
      expect(gridTarget(dates, '2025-11-01', 'ArrowDown', 'week')).toBe(
        '2025-11-03',
      );
    });

    it('on the phone list, moves one item at a time', () => {
      expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowDown', 'list')).toBe(
        '2025-11-02',
      );
      expect(gridTarget(FIXTURE, '2025-11-01', 'ArrowUp', 'list')).toBe(
        '2025-10-31',
      );
    });

    it('ignores a date that is not in the grid, and copes with unsorted or repeated input', () => {
      expect(
        gridTarget(FIXTURE, '2025-12-01', 'ArrowDown', 'year'),
      ).toBeUndefined();
      expect(
        gridTarget(
          ['2025-11-03', '2025-11-01', '2025-11-01'],
          '2025-11-01',
          'ArrowRight',
          'list',
        ),
      ).toBe('2025-11-03');
    });
  });

  describe('isNavKey as isGridKey', () => {
    it('accept only the grid keys', () => {
      for (const key of [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ])
        expect(isNavKey(key)).toBe(true);
      expect(isNavKey('PageDown')).toBe(false);
    });
  });
});
