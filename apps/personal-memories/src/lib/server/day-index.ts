import { type DayIndex, indexDays } from '@/lib/days.ts';
import { type MarkerView, markerViewsByDate } from '@/lib/markers.ts';

import { getMarkers, postedOnLookup } from './markers-store.ts';
import { getPeople } from './people-store.ts';
import { getTimeline } from './store.ts';

export async function getDayIndex(): Promise<DayIndex | undefined> {
  const [state, markers] = await Promise.all([getTimeline(), getMarkers()]);
  return state.status === 'ready'
    ? indexDays(state.timeline.events, markers.dates)
    : undefined;
}

export async function getMarkerViews(): Promise<Map<string, MarkerView[]>> {
  const [state, people, markers] = await Promise.all([
    getTimeline(),
    getPeople(),
    getMarkers(),
  ]);
  return markerViewsByDate(
    markers.byDate,
    people.people,
    people.owners,
    postedOnLookup(state),
  );
}
