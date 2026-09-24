import { useEffect, useState } from 'react';

import type { NotePayload } from '../lib/notes/payload.ts';
import { dayHeading } from '../lib/weeks.ts';
import { AnnotationItem } from './notes/AnnotationItem.tsx';
import { ConflictView } from './notes/ConflictView.tsx';
import { useDaySync } from './notes/useDaySync.ts';
import { type SaveStatus, useNoteDraft } from './notes/useNoteDraft.ts';
import { useStreamBridge } from './notes/useStreamBridge.ts';

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: '已儲存',
  dirty: '儲存中',
  saving: '儲存中',
  error: '未儲存',
  conflict: '有衝突',
};

const LOAD_FAILED = '載入失敗，捲動時會再試';

export function NotePanel({ initial }: { initial: NotePayload }) {
  const note = useNoteDraft(initial);
  const { payload, draft, status, conflict, current, edit } = note;
  const { request, loadFailed } = useDaySync({ ...note, current });
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const readOnly = !payload.writable;
  const locked = readOnly || !hydrated;
  const { reattach, setReattach, setAnnotation, refs } = useStreamBridge({
    date: payload.date,
    draft,
    current,
    readOnly,
    edit,
    request,
    onAnnotate: () => setOpen(true),
  });
  const failed = status === 'error' || (loadFailed && status === 'saved');

  return (
    <aside
      aria-label="筆記"
      className="border-border bg-card fixed inset-x-0 bottom-0 z-20 border-t lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:rounded-lg lg:border lg:bg-transparent"
    >
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="focus-visible:ring-ring flex-1 text-left font-medium focus-visible:outline-none focus-visible:ring-2 lg:pointer-events-none"
        >
          筆記 ·{' '}
          <span
            className={
              failed
                ? 'bg-destructive/10 text-destructive rounded px-1.5 py-0.5'
                : 'text-muted-foreground'
            }
          >
            {loadFailed && status === 'saved'
              ? LOAD_FAILED
              : STATUS_LABELS[status]}
          </span>
        </button>
        <span className="text-muted-foreground text-xs">
          {dayHeading(payload.date)}
        </span>
      </div>
      <div
        className={`${open ? 'block' : 'hidden'} max-h-[70vh] space-y-4 overflow-y-auto p-4 pt-0 lg:block lg:max-h-none lg:overflow-visible`}
      >
        {readOnly && (
          <p className="bg-muted text-muted-foreground rounded-md p-2 text-xs">
            筆記是唯讀的：未設定可寫入的 <code>MEMORIES_NOTES_DIR</code>。
          </p>
        )}
        {conflict && (
          <ConflictView
            theirs={conflict}
            mine={draft}
            onResolve={note.resolveConflict}
          />
        )}
        <textarea
          aria-label="當天的回憶"
          value={draft.body}
          disabled={locked}
          rows={6}
          onChange={(e) => edit((d) => ({ ...d, body: e.target.value }))}
          className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        <ul className="space-y-3">
          {draft.annotations.map((a, i) => (
            <AnnotationItem
              key={`${i}-${a.eventId}`}
              annotation={a}
              disabled={locked}
              reattaching={reattach === i}
              textareaRef={(el) => {
                refs.current[i] = el;
              }}
              onBody={(body) => setAnnotation(i, { body })}
              onReattach={() => setReattach(i)}
              onDelete={() => {
                setReattach(undefined);
                edit((d) => ({
                  ...d,
                  annotations: d.annotations.filter((_, j) => j !== i),
                }));
              }}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
