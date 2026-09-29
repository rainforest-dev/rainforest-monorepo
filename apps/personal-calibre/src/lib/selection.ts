export type CheckState = 'none' | 'some' | 'all';

export function toggleId(
  set: ReadonlySet<number>,
  id: number,
): ReadonlySet<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function addIds(
  set: ReadonlySet<number>,
  ids: readonly number[],
): ReadonlySet<number> {
  const next = new Set(set);
  for (const id of ids) next.add(id);
  return next;
}

export function removeIds(
  set: ReadonlySet<number>,
  ids: readonly number[],
): ReadonlySet<number> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

export function pageCheckState(
  set: ReadonlySet<number>,
  pageIds: readonly number[],
): CheckState {
  const selectedOnPage = pageIds.filter((id) => set.has(id)).length;
  if (selectedOnPage === 0) return 'none';
  return selectedOnPage === pageIds.length ? 'all' : 'some';
}

export function togglePage(
  set: ReadonlySet<number>,
  pageIds: readonly number[],
): ReadonlySet<number> {
  return pageCheckState(set, pageIds) === 'all'
    ? removeIds(set, pageIds)
    : addIds(set, pageIds);
}
