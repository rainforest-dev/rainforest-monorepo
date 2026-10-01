import { describe, expect, it } from 'vitest';

import { type NavEntry, toNavItems } from './roving';

const rect = (left: number, top: number) => ({
  left,
  top,
  width: 148,
  height: 272,
});

describe('toNavItems', () => {
  it('numbers group rows in the order they first appear', () => {
    const entries: NavEntry[] = [
      { key: 'series:9:1', group: 'series:9', rect: rect(0, 0) },
      { key: 'series:9:2', group: 'series:9', rect: rect(170, 0) },
      { key: 'series:2:5', group: 'series:2', rect: rect(0, 360) },
      { key: 'tag:1:7', group: 'tag:1', rect: rect(0, 720) },
    ];
    expect(toNavItems(entries, 'grid')).toEqual([
      { key: 'series:9:1', row: 0, order: 0, rect: rect(0, 0) },
      { key: 'series:9:2', row: 0, order: 1, rect: rect(170, 0) },
      { key: 'series:2:5', row: 1, order: 2, rect: rect(0, 360) },
      { key: 'tag:1:7', row: 2, order: 3, rect: rect(0, 720) },
    ]);
  });

  it('derives grid rows from the item tops when a group is missing', () => {
    const entries: NavEntry[] = [
      { key: 'all:1', group: '', rect: rect(0, 0.4) },
      { key: 'all:2', group: '', rect: rect(170, 0) },
      { key: 'all:3', group: '', rect: rect(0, 300) },
    ];
    expect(toNavItems(entries, 'grid').map((item) => item.row)).toEqual([
      0, 0, 300,
    ]);
  });

  it('keeps an ungrouped list as one row', () => {
    const entries: NavEntry[] = [
      { key: 'all:1', group: '', rect: rect(0, 0) },
      { key: 'all:2', group: '', rect: rect(0, 48) },
    ];
    expect(toNavItems(entries, 'list').map((item) => item.row)).toEqual([0, 0]);
  });
});
