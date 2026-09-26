import { bySuffix, type NotePreview } from '../notes/preview.ts';

export function paintNotes(
  root: ParentNode,
  previews: ReadonlyMap<string, NotePreview>,
) {
  for (const row of root.querySelectorAll<HTMLElement>('[data-event-id]')) {
    const preview = previews.get(row.dataset['eventId'] ?? '');
    row.toggleAttribute('data-annotated', preview !== undefined);
    const body = row.querySelector('[data-note-body]');
    const by = row.querySelector('[data-note-by]');
    if (body) body.textContent = preview?.body ?? '';
    if (by) by.textContent = bySuffix(preview?.by);
  }
}
