import type { LiveLoader } from 'astro/loaders';
import { defineLiveCollection } from 'astro:content';

import { DATE_RE, type DaySummary, neighbours, summarize } from '@/lib';
import { getDayIndex, notesStore, type TimelineEvent } from '@/lib/server';

export type DayData = {
  summary: DaySummary;
  events?: TimelineEvent[];
  prev?: string;
  next?: string;
};

const daysLoader: LiveLoader<DayData, { date: string }> = {
  name: 'memories-days',
  async loadCollection() {
    const index = await getDayIndex();
    if (!index) return { entries: [] };
    return {
      entries: summarize(index).map((summary) => ({
        id: summary.date,
        data: { summary },
      })),
    };
  },
  async loadEntry({ filter }) {
    if (!DATE_RE.test(filter.date)) return undefined;
    const index = await getDayIndex();
    const events = index?.byDate.get(filter.date);
    if (!index || !events) return undefined;
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
