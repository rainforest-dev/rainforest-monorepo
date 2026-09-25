import { SOURCE_LABELS } from './notes/types.ts';
import type { TimelineSource } from './timeline.ts';

const ORDER: readonly TimelineSource[] = ['line', 'slack', 'photo'];

export const SOURCES: { source: TimelineSource; label: string }[] = ORDER.map(
  (source) => ({ source, label: SOURCE_LABELS[source] }),
);

export const HIDDEN_KEY = 'memories:hidden-sources';

export const hiddenFrom = (visible: readonly string[]) =>
  ORDER.filter((s) => !visible.includes(s));
