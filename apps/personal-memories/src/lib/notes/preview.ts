import type { ResolvedAnnotation } from './attach.ts';

export type NotePreview = { body: string; by?: string };

const EMPTY_BODY = '眉批';

export function notePreviews(
  annotations: readonly ResolvedAnnotation[],
): Map<string, NotePreview> {
  const previews = new Map<string, NotePreview>();
  for (const a of annotations) {
    if (a.status === 'unattached' || !a.eventId || previews.has(a.eventId))
      continue;
    const preview: NotePreview = { body: a.body.trim() || EMPTY_BODY };
    if (a.by) preview.by = a.by;
    previews.set(a.eventId, preview);
  }
  return previews;
}

export const bySuffix = (by?: string) => (by ? ` · ${by}` : '');
