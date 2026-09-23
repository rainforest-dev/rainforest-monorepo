import type { TimelineEvent } from '../timeline.ts';
import type { Annotation } from './types.ts';

export type AttachStatus = 'exact' | 'recovered' | 'unattached';
export type ResolvedAnnotation = Annotation & { status: AttachStatus };

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

export function excerptOf(
  event: Pick<TimelineEvent, 'text' | 'source'>,
  max = 40,
): string {
  const text = collapse(event.text ?? '');
  if (!text) return event.source === 'photo' ? '照片' : '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function resolveOne(
  annotation: Annotation,
  events: readonly TimelineEvent[],
): ResolvedAnnotation {
  if (!annotation.eventId) return { ...annotation, status: 'unattached' };
  if (events.some((e) => e.id === annotation.eventId)) {
    return { ...annotation, status: 'exact' };
  }
  const stem = annotation.excerpt.replace(/…$/, '');
  const match = events.find(
    (e) =>
      e.at === annotation.at &&
      e.source === annotation.source &&
      e.author === annotation.author &&
      (e.source === 'photo' ? true : collapse(e.text ?? '').startsWith(stem)),
  );
  return match
    ? { ...annotation, eventId: match.id, status: 'recovered' }
    : { ...annotation, status: 'unattached' };
}

export function resolveAnnotations(
  annotations: readonly Annotation[],
  dayEvents: readonly TimelineEvent[],
): ResolvedAnnotation[] {
  const resolved = annotations.map((a) => resolveOne(a, dayEvents));
  return [
    ...resolved.filter((r) => r.status === 'unattached'),
    ...resolved.filter((r) => r.status !== 'unattached'),
  ];
}
