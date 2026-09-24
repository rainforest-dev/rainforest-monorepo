import { useState } from 'react';

import type { NotePayload } from '../lib/notes/payload.ts';
import { AnnotationItem } from './notes/AnnotationItem.tsx';
import { ConflictView } from './notes/ConflictView.tsx';
import { type SaveStatus, useNoteDraft } from './notes/useNoteDraft.ts';
import { useStreamBridge } from './notes/useStreamBridge.ts';

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: '已儲存',
  dirty: '儲存中',
  saving: '儲存中',
  error: '未儲存',
  conflict: '有衝突',
};

export function NotePanel({ initial }: { initial: NotePayload }) {
  const { payload, draft, status, conflict, edit, load, resolveConflict } =
    useNoteDraft(initial);
  const [open, setOpen] = useState(false);
  const readOnly = !payload.writable;
  const { reattach, setReattach, setAnnotation, refs } = useStreamBridge({
    date: payload.date,
    draft,
    readOnly,
    edit,
    load,
    onAnnotate: () => setOpen(true),
  });

  return (
    <aside
      aria-label="筆記"
      className="border-border bg-card fixed inset-x-0 bottom-0 z-20 border-t lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:rounded-lg lg:border lg:bg-transparent"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="focus-visible:ring-ring w-full px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 lg:pointer-events-none"
      >
        筆記 ·{' '}
        <span
          className={
            status === 'error'
              ? 'bg-destructive/10 text-destructive rounded px-1.5 py-0.5'
              : 'text-muted-foreground'
          }
        >
          {STATUS_LABELS[status]}
        </span>
      </button>
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
            onResolve={resolveConflict}
          />
        )}
        <textarea
          aria-label="當天的回憶"
          value={draft.body}
          disabled={readOnly}
          rows={6}
          onChange={(e) => edit((d) => ({ ...d, body: e.target.value }))}
          className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        <ul className="space-y-3">
          {draft.annotations.map((a, i) => (
            <AnnotationItem
              key={`${i}-${a.eventId}`}
              annotation={a}
              disabled={readOnly}
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
