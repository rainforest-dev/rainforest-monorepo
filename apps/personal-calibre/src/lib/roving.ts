import {
  assignRowsByTop,
  type NavItem,
  type NavMode,
  type NavRect,
} from '@rainforest-dev/rainforest-ui/interaction';

export interface NavEntry {
  key: string;
  group: string;
  rect: NavRect;
}

export function toNavItems(
  entries: readonly NavEntry[],
  mode: NavMode,
): NavItem[] {
  if (mode === 'grid' && entries.some((entry) => entry.group === '')) {
    return assignRowsByTop(
      entries.map(({ key, rect }, order) => ({ key, order, rect })),
    );
  }
  const rows = new Map<string, number>();
  return entries.map(({ key, group, rect }, order) => {
    let row = rows.get(group);
    if (row === undefined) {
      row = rows.size;
      rows.set(group, row);
    }
    return { key, row, order, rect };
  });
}
