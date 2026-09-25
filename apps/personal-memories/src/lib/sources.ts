import type { TimelineSource } from './timeline.ts';

export const SOURCES: { source: TimelineSource; label: string }[] = [
  { source: 'line', label: 'LINE' },
  { source: 'slack', label: 'Slack' },
  { source: 'photo', label: '照片' },
];

export const HIDDEN_KEY = 'memories:hidden-sources';

const ALL: readonly string[] = SOURCES.map((s) => s.source);

export function parseHidden(raw: string | null): TimelineSource[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value)
      ? value.filter(
          (s): s is TimelineSource => typeof s === 'string' && ALL.includes(s),
        )
      : [];
  } catch {
    return [];
  }
}

export const visibleFrom = (hidden: readonly string[]) =>
  ALL.filter((s) => !hidden.includes(s));

export const hiddenFrom = (visible: readonly string[]) =>
  ALL.filter((s) => !visible.includes(s));
