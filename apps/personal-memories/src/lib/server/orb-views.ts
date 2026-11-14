import { pickCover } from '@/lib/cover.ts';
import { indexDays } from '@/lib/days.ts';
import {
  isCore,
  type OrbEntry,
  type OrbsFile,
  parseOrbKey,
  PERSON_COLORS,
  type PrintRow,
} from '@/lib/orbs.ts';
import { taipeiDate } from '@/lib/weeks.ts';

import type { NotesStore } from './notes-store.ts';
import { orbPair, type OrbPerson, readOrbs, viewerId } from './orbs-store.ts';
import { getPeople } from './people-store.ts';
import { getTimeline, type TimelineState } from './store.ts';

export type OrbItem = {
  key: string;
  kind: 'day' | 'photo';
  date: string;
  eventId?: string;
  entry: OrbEntry;
};

export function orbItems(file: OrbsFile, state: TimelineState): OrbItem[] {
  const out: OrbItem[] = [];
  for (const [key, entry] of Object.entries(file.orbs)) {
    const parsed = parseOrbKey(key);
    if (!parsed) continue;
    if (parsed.kind === 'day') {
      out.push({ key, kind: 'day', date: parsed.date, entry });
      continue;
    }
    const event =
      state.status === 'ready' ? state.byId.get(parsed.eventId) : undefined;
    if (!event) continue;
    out.push({
      key,
      kind: 'photo',
      date: taipeiDate(event.at),
      eventId: parsed.eventId,
      entry,
    });
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
  );
}

export type OrbContext = {
  pair: OrbPerson[];
  viewer: string | undefined;
  file: OrbsFile;
  state: TimelineState;
};

export async function orbContext(headers: Headers): Promise<OrbContext> {
  const [people, state] = await Promise.all([getPeople(), getTimeline()]);
  const pair = orbPair(people, PERSON_COLORS);
  const id = viewerId(headers, people);
  return {
    pair,
    viewer: pair.some((p) => p.id === id) ? id : undefined,
    file: readOrbs(),
    state,
  };
}

export function printRows(
  items: readonly OrbItem[],
  pair: readonly OrbPerson[],
  state: TimelineState,
  notes: NotesStore | undefined,
): PrintRow[] {
  if (state.status !== 'ready') return [];
  const ids = pair.map((p) => p.id);
  const byDate = indexDays(state.timeline.events).byDate;
  const rows: PrintRow[] = [];
  for (const item of items) {
    if (!isCore(item.entry, ids)) continue;
    const id =
      item.kind === 'photo'
        ? item.eventId
        : pickCover(
            byDate.get(item.date) ?? [],
            notes?.read(item.date).note.cover,
          )?.id;
    const path = id ? state.byId.get(id)?.media?.[0]?.path : undefined;
    if (path) rows.push({ date: item.date, kind: item.kind, path });
  }
  return rows;
}
