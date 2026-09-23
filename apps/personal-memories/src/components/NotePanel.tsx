import type { NotePayload } from '../lib/notes/payload.ts';

export function NotePanel(_: { initial: NotePayload }) {
  return <aside aria-label="筆記" />;
}
