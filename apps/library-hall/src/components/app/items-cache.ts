import type { HallItem } from '@rainforest-dev/library-contract';

export interface HallItemsPayload {
  items: HallItem[];
  sources: { collection: string; ok: boolean; count: number }[];
}

const KEY = 'library-hall:items';

/** The last shelf list this tab saw, so a return to the hall draws before the refetch lands. */
export function readItemsCache(): HallItemsPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<HallItemsPayload>;
    return Array.isArray(value.items) && Array.isArray(value.sources)
      ? (value as HallItemsPayload)
      : null;
  } catch {
    return null;
  }
}

export function writeItemsCache(payload: HallItemsPayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Over quota or blocked: the hall just waits for the network next time.
  }
}
