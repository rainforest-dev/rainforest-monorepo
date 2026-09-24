import { useEffect, useState } from 'react';

import type { NotePayload } from '../lib/notes/payload.ts';
import { dayHeading } from '../lib/weeks.ts';
import { AnnotationList } from './notes/AnnotationItem.tsx';
import {
  BottomSheet,
  CHIPS,
  LOAD_FAILED,
  Notice,
  StatusChip,
} from './notes/BottomSheet.tsx';
import { ConflictView } from './notes/ConflictView.tsx';
import { useDaySync } from './notes/useDaySync.ts';
import { useNoteDraft } from './notes/useNoteDraft.ts';
import { useStreamBridge } from './notes/useStreamBridge.ts';

const PLACEHOLDER = '這一天想起了什麼？';
const TITLE = 'text-meta font-semibold';

export function NotePanel({ initial }: { initial: NotePayload }) {
  const note = useNoteDraft(initial);
  const { payload, draft, status, conflict, current, edit } = note;
  const { request, loadFailed } = useDaySync({ ...note, current });
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const readOnly = !payload.writable;
  const { date } = payload;
  const locked = readOnly || !hydrated;
  const { reattach, setReattach, setAnnotation, refs } = useStreamBridge({
    date,
    draft,
    current,
    readOnly,
    edit,
    request,
    onAnnotate: () => setOpen(true),
  });
  const chip =
    loadFailed && status === 'saved'
      ? LOAD_FAILED
      : readOnly
        ? undefined
        : CHIPS[status];
  const count = draft.annotations.length;

  const peek = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className={TITLE}>這一天的回憶</span>
        {chip && <StatusChip chip={chip} />}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        眉批 {count}
      </span>
      <span
        className={`text-meta line-clamp-2 whitespace-pre-line ${draft.body ? '' : 'text-muted-foreground'}`}
      >
        {draft.body || (readOnly ? '' : PLACEHOLDER)}
      </span>
    </>
  );

  return (
    <BottomSheet open={open} onOpenChange={setOpen} peek={peek}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className={TITLE}>這一天的回憶</h2>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {dayHeading(date)}
          </span>
        </div>
        {chip && <StatusChip chip={chip} />}
      </div>
      {(payload.parseError || readOnly) && (
        <div className="mb-3">
          <Notice>
            {payload.parseError
              ? '這一天的筆記檔格式有誤，請在 Obsidian 修正後重新整理。'
              : '唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。'}
          </Notice>
        </div>
      )}
      {conflict && (
        <ConflictView
          theirs={conflict}
          mine={draft}
          onResolve={note.resolveConflict}
        />
      )}
      {readOnly ? (
        draft.body && (
          <div className="bg-muted/55 text-body whitespace-pre-wrap rounded-lg px-4 py-3.5">
            {draft.body}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2" hidden={!!conflict}>
          <textarea
            aria-label="當天的回憶"
            placeholder={PLACEHOLDER}
            value={draft.body}
            disabled={locked}
            onChange={(e) =>
              edit(date, (d) => ({ ...d, body: e.target.value }))
            }
            className="border-input bg-background text-body focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-3 placeholder:text-muted-foreground min-h-[180px] w-full resize-none rounded-lg border px-4 py-3.5 outline-none disabled:opacity-60 lg:min-h-[232px]"
          />
          <p className="text-muted-foreground text-xs">Markdown · 自動儲存</p>
        </div>
      )}
      <AnnotationList
        annotations={draft.annotations}
        disabled={locked}
        readOnly={readOnly}
        reattach={reattach}
        refs={refs}
        onBody={(i, body) => setAnnotation(date, i, { body })}
        onReattach={setReattach}
        onDelete={(i) => {
          setReattach(undefined);
          edit(date, (d) => ({
            ...d,
            annotations: d.annotations.filter((_, j) => j !== i),
          }));
        }}
      />
    </BottomSheet>
  );
}
