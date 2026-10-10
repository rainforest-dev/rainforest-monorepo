import { type DayIndex, indexDays } from '@/lib/days.ts';
import { type MarkerView, markerViewsByDate } from '@/lib/markers.ts';

import { getMarkers, type MarkerSet, postedOnLookup } from './markers-store.ts';
import { getPeople, type PeopleConfig } from './people-store.ts';
import { getTimeline, type TimelineState } from './store.ts';

export async function getDayIndex(): Promise<DayIndex | undefined> {
  const [state, markers] = await Promise.all([getTimeline(), getMarkers()]);
  return state.status === 'ready'
    ? indexDays(state.timeline.events, markers.dates)
    : undefined;
}

export async function markerViewsFor(
  markers: MarkerSet,
  people: () => Promise<PeopleConfig>,
  state: TimelineState,
): Promise<Map<string, MarkerView[]>> {
  if (markers.byDate.size === 0) return new Map();
  const config = await people();
  return markerViewsByDate(
    markers.byDate,
    config.people,
    config.owners,
    postedOnLookup(state),
  );
}

export async function getMarkerViews(): Promise<Map<string, MarkerView[]>> {
  const [state, markers] = await Promise.all([getTimeline(), getMarkers()]);
  return markerViewsFor(markers, getPeople, state);
}
