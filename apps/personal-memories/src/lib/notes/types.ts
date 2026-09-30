import type { TimelineSource } from '../timeline.ts';

export type Annotation = {
  eventId: string;
  at: string;
  source: TimelineSource;
  author: string;
  excerpt: string;
  body: string;
  by?: string;
};

export type DayNote = {
  date: string;
  frontmatter: Record<string, unknown>;
  body: string;
  annotations: Annotation[];
  cover?: string;
  annotationsPreamble?: string;
  trailing?: string;
};

export const ANNOTATIONS_HEADING = '## 眉批';

export const SOURCE_LABELS: Record<TimelineSource, string> = {
  line: 'LINE',
  slack: 'Slack',
  photo: '照片',
};
