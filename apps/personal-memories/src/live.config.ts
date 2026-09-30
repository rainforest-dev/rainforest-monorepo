import type { LiveLoader } from 'astro/loaders';
import { defineLiveCollection } from 'astro:content';

import {
  DATE_RE,
  type DaySummary,
  indexDays,
  neighbours,
  summarize,
} from './lib/days.ts';
import { notesStore } from './lib/notes/store.ts';
import { getTimeline } from './lib/store.ts';
import type { TimelineEvent } from './lib/timeline.ts';

export type DayData = {
  summary: DaySummary;
  events?: TimelineEvent[];
  prev?: string;
  next?: string;
};

const daysLoader: LiveLoader<DayData, { date: string }> = {
  name: 'memories-days',
  async loadCollection() {
    const state = getTimeline();
    if (state.status !== 'ready') return { entries: [] };
    const index = indexDays(state.timeline.events);
    return {
      entries: summarize(index).map((summary) => ({
        id: summary.date,
        data: { summary },
      })),
    };
  },
  async loadEntry({ filter }) {
    const state = getTimeline();
    if (state.status !== 'ready' || !DATE_RE.test(filter.date))
      return undefined;
    const index = indexDays(state.timeline.events);
    const events = index.byDate.get(filter.date);
    if (!events) return undefined;
    const [summary] = summarize({ dates: [filter.date], byDate: index.byDate });
    return {
      id: filter.date,
      data: { summary, events, ...neighbours(index, filter.date) },
    };
  },
};

const notesLoader: LiveLoader<{ date: string }> = {
  name: 'memories-notes',
  async loadCollection() {
    const dates = [...(notesStore()?.dates() ?? [])].sort();
    return { entries: dates.map((date) => ({ id: date, data: { date } })) };
  },
  async loadEntry() {
    return undefined;
  },
};

export const collections = {
  days: defineLiveCollection({ loader: daysLoader }),
  memoryNotes: defineLiveCollection({ loader: notesLoader }),
};
